"""Chargement de la configuration depuis l'environnement (et un éventuel fichier .env)."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _load_dotenv(path: str = ".env") -> None:
    """Charge un .env minimal sans dépendance externe.

    N'écrase jamais une variable déjà présente dans l'environnement.
    """
    p = Path(path)
    if not p.is_file():
        return
    for raw in p.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def _parse_user_ids(raw: str) -> set[int]:
    ids: set[int] = set()
    for part in raw.replace(";", ",").split(","):
        part = part.strip()
        if part:
            try:
                ids.add(int(part))
            except ValueError:
                continue
    return ids


@dataclass
class Config:
    bot_token: str
    output_dir: Path
    check_interval: int = 60
    allowed_users: set[int] = field(default_factory=set)
    tiktok_sessionid: str = ""
    upload_limit_mb: int = 49
    watchlist_path: Path = Path("watchlist.json")

    @property
    def upload_limit_bytes(self) -> int:
        return self.upload_limit_mb * 1024 * 1024

    def is_allowed(self, user_id: int) -> bool:
        """Vrai si l'utilisateur peut piloter le bot (liste vide = tout le monde)."""
        return not self.allowed_users or user_id in self.allowed_users

    @classmethod
    def from_env(cls, dotenv: str = ".env") -> "Config":
        _load_dotenv(dotenv)

        token = os.environ.get("BOT_TOKEN", "").strip()
        if not token:
            raise RuntimeError(
                "BOT_TOKEN manquant. Copie .env.example en .env et renseigne le token "
                "du bot fourni par @BotFather."
            )

        output_dir = Path(os.environ.get("OUTPUT_DIR", "./recordings")).expanduser()

        try:
            check_interval = max(15, int(os.environ.get("CHECK_INTERVAL", "60")))
        except ValueError:
            check_interval = 60

        try:
            upload_limit = int(os.environ.get("TELEGRAM_UPLOAD_LIMIT_MB", "49"))
        except ValueError:
            upload_limit = 49

        return cls(
            bot_token=token,
            output_dir=output_dir,
            check_interval=check_interval,
            allowed_users=_parse_user_ids(os.environ.get("ALLOWED_USERS", "")),
            tiktok_sessionid=os.environ.get("TIKTOK_SESSIONID", "").strip(),
            upload_limit_mb=upload_limit,
        )
