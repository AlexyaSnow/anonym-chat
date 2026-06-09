"""Bot Telegram TikRec : surveillance et enregistrement des lives TikTok."""

from __future__ import annotations

import asyncio
import logging
from functools import wraps
from typing import Callable

from telegram import Update
from telegram.constants import ParseMode
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
)

from .config import Config
from .recorder import Recording, ffmpeg_available
from .tiktok import TikTokClient, TikTokError
from .watchlist import Watchlist

logger = logging.getLogger("tikrec")


def _fmt_size(num: int) -> str:
    value = float(num)
    for unit in ("o", "Ko", "Mo", "Go"):
        if value < 1024 or unit == "Go":
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} Go"


def _fmt_duration(seconds: float) -> str:
    s = int(seconds)
    h, rem = divmod(s, 3600)
    m, sec = divmod(rem, 60)
    if h:
        return f"{h}h{m:02d}m{sec:02d}s"
    return f"{m}m{sec:02d}s"


def restricted(func: Callable) -> Callable:
    """Refuse les commandes des utilisateurs non autorisés."""

    @wraps(func)
    async def wrapper(self: "TikRecBot", update: Update, context: ContextTypes.DEFAULT_TYPE):
        user = update.effective_user
        if user is None or not self.config.is_allowed(user.id):
            if update.effective_message:
                await update.effective_message.reply_text(
                    "⛔ Tu n'es pas autorisé à utiliser ce bot."
                )
            return
        return await func(self, update, context)

    return wrapper


class TikRecBot:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.client = TikTokClient(sessionid=config.tiktok_sessionid)
        self.watchlist = Watchlist(config.watchlist_path)
        # pseudo (lower) -> Recording en cours
        self.active: dict[str, Recording] = {}

    # -- construction -------------------------------------------------------

    def build(self) -> Application:
        app = Application.builder().token(self.config.bot_token).build()
        app.add_handler(CommandHandler("start", self.cmd_start))
        app.add_handler(CommandHandler("help", self.cmd_start))
        app.add_handler(CommandHandler("watch", self.cmd_watch))
        app.add_handler(CommandHandler("unwatch", self.cmd_unwatch))
        app.add_handler(CommandHandler("list", self.cmd_list))
        app.add_handler(CommandHandler("record", self.cmd_record))
        app.add_handler(CommandHandler("status", self.cmd_status))

        app.job_queue.run_repeating(
            self.poll_job, interval=self.config.check_interval, first=5
        )
        return app

    # -- commandes ----------------------------------------------------------

    @restricted
    async def cmd_start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        text = (
            "🎬 *TikRec* — enregistreur de lives TikTok\n\n"
            "Ajoute un pseudo à surveiller : dès qu'il passe en live, "
            "j'enregistre automatiquement.\n\n"
            "*Commandes*\n"
            "• `/watch <pseudo>` — surveiller un pseudo (auto-record)\n"
            "• `/unwatch <pseudo>` — arrêter de surveiller\n"
            "• `/list` — pseudos surveillés\n"
            "• `/record <pseudo>` — enregistrer le live en cours (ponctuel)\n"
            "• `/status` — enregistrements en cours\n"
        )
        if not ffmpeg_available():
            text += "\n⚠️ *ffmpeg introuvable* — l'enregistrement échouera tant qu'il n'est pas installé."
        await update.effective_message.reply_text(text, parse_mode=ParseMode.MARKDOWN)

    @restricted
    async def cmd_watch(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg = update.effective_message
        if not context.args:
            await msg.reply_text("Usage : `/watch <pseudo>`", parse_mode=ParseMode.MARKDOWN)
            return
        chat_id = update.effective_chat.id
        added, already = [], []
        for raw in context.args:
            username = self.client.normalize_username(raw)
            if not username:
                continue
            if self.watchlist.add(username, chat_id):
                added.append(username)
            else:
                already.append(username)
        parts = []
        if added:
            parts.append("✅ Surveillé : " + ", ".join(f"@{u}" for u in added))
        if already:
            parts.append("ℹ️ Déjà surveillé : " + ", ".join(f"@{u}" for u in already))
        await msg.reply_text("\n".join(parts) or "Rien à ajouter.")

    @restricted
    async def cmd_unwatch(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg = update.effective_message
        if not context.args:
            await msg.reply_text("Usage : `/unwatch <pseudo>`", parse_mode=ParseMode.MARKDOWN)
            return
        removed, missing = [], []
        for raw in context.args:
            username = self.client.normalize_username(raw)
            if self.watchlist.remove(username):
                removed.append(username)
            else:
                missing.append(username)
        parts = []
        if removed:
            parts.append("🗑️ Retiré : " + ", ".join(f"@{u}" for u in removed))
        if missing:
            parts.append("ℹ️ Pas dans la liste : " + ", ".join(f"@{u}" for u in missing))
        await msg.reply_text("\n".join(parts) or "Rien à retirer.")

    @restricted
    async def cmd_list(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        usernames = self.watchlist.usernames()
        if not usernames:
            await update.effective_message.reply_text(
                "La liste de surveillance est vide. Ajoute un pseudo avec `/watch <pseudo>`.",
                parse_mode=ParseMode.MARKDOWN,
            )
            return
        lines = ["👀 *Pseudos surveillés*"]
        for u in usernames:
            mark = " 🔴 (enregistrement)" if u in self.active else ""
            lines.append(f"• @{u}{mark}")
        await update.effective_message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)

    @restricted
    async def cmd_record(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        msg = update.effective_message
        if not context.args:
            await msg.reply_text("Usage : `/record <pseudo>`", parse_mode=ParseMode.MARKDOWN)
            return
        username = self.client.normalize_username(context.args[0])
        chat_id = update.effective_chat.id

        if username.lower() in self.active:
            await msg.reply_text(f"⏺️ @{username} est déjà en cours d'enregistrement.")
            return

        await msg.reply_text(f"🔎 Vérification du live de @{username}…")
        try:
            info = await asyncio.to_thread(self.client.check_live, username)
        except TikTokError as exc:
            await msg.reply_text(f"⚠️ Erreur TikTok pour @{username} : {exc}")
            return

        if not info.is_live or not info.stream_url:
            await msg.reply_text(f"💤 @{username} n'est pas en live actuellement.")
            return

        await self._start_recording(context, username, info.stream_url, chat_id, info.title)

    @restricted
    async def cmd_status(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        if not self.active:
            await update.effective_message.reply_text(
                f"Aucun enregistrement en cours.\n{len(self.watchlist)} pseudo(s) surveillé(s)."
            )
            return
        lines = ["⏺️ *Enregistrements en cours*"]
        for username, rec in self.active.items():
            lines.append(
                f"• @{username} — {_fmt_duration(rec.duration)}, {_fmt_size(rec.size_bytes)}"
            )
        await update.effective_message.reply_text("\n".join(lines), parse_mode=ParseMode.MARKDOWN)

    # -- boucle de surveillance --------------------------------------------

    async def poll_job(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Exécutée périodiquement : finalise les enregistrements terminés
        puis lance ceux des pseudos passés en live."""
        await self._finalize_finished(context)

        for username, chat_id in self.watchlist.items():
            if username in self.active:
                continue
            try:
                info = await asyncio.to_thread(self.client.check_live, username)
            except TikTokError as exc:
                logger.warning("check_live(%s) a échoué : %s", username, exc)
                continue
            if info.is_live and info.stream_url:
                await self._start_recording(context, username, info.stream_url, chat_id, info.title)

    async def _start_recording(
        self,
        context: ContextTypes.DEFAULT_TYPE,
        username: str,
        stream_url: str,
        chat_id: int,
        title: str | None,
    ) -> None:
        rec = Recording(username, stream_url, self.config.output_dir)
        try:
            rec.start()
        except Exception as exc:  # ffmpeg manquant, etc.
            logger.error("Impossible de démarrer l'enregistrement de %s : %s", username, exc)
            await context.bot.send_message(chat_id, f"⚠️ Échec du démarrage pour @{username} : {exc}")
            return
        self.active[username.lower()] = rec
        suffix = f"\n📝 {title}" if title else ""
        await context.bot.send_message(
            chat_id, f"🔴 @{username} est en live — enregistrement démarré.{suffix}"
        )

    async def _finalize_finished(self, context: ContextTypes.DEFAULT_TYPE) -> None:
        finished = [(u, r) for u, r in self.active.items() if not r.is_running]
        for username, rec in finished:
            self.active.pop(username, None)
            chat_id = self.watchlist.chat_id_for(username)
            if chat_id is None:
                continue
            await self._deliver(context, chat_id, username, rec)

    async def _deliver(
        self, context: ContextTypes.DEFAULT_TYPE, chat_id: int, username: str, rec: Recording
    ) -> None:
        size = rec.size_bytes
        summary = (
            f"⏹️ Live de @{username} terminé.\n"
            f"⌛ Durée : {_fmt_duration(rec.duration)}\n"
            f"💾 Taille : {_fmt_size(size)}"
        )
        if size == 0:
            await context.bot.send_message(
                chat_id, f"⚠️ Live de @{username} terminé mais le fichier est vide."
            )
            return

        if size <= self.config.upload_limit_bytes:
            try:
                with open(rec.path, "rb") as fh:
                    await context.bot.send_video(chat_id, fh, caption=summary)
                return
            except Exception as exc:  # fichier trop gros pour Telegram, etc.
                logger.warning("Envoi du fichier %s échoué : %s", rec.path, exc)

        await context.bot.send_message(
            chat_id, summary + f"\n📁 Fichier enregistré sur le serveur :\n`{rec.path}`",
            parse_mode=ParseMode.MARKDOWN,
        )
