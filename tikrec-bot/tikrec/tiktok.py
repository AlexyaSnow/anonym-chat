"""Accès à l'API web de TikTok : résolution du room_id, état du live, URL du flux.

Cette logique s'appuie sur les endpoints publics utilisés par le site web de
TikTok. Aucune clé privée n'est requise ; un cookie ``sessionid`` peut être
fourni pour fiabiliser les requêtes (lives à restriction régionale/d'âge).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

import requests

_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# Statuts renvoyés par l'API room/info de TikTok.
STATUS_LIVE = 2
STATUS_ENDED = 4


class TikTokError(RuntimeError):
    """Erreur de communication ou de parsing avec l'API TikTok."""


@dataclass
class LiveInfo:
    """Résultat d'une vérification d'état de live."""

    username: str
    is_live: bool
    room_id: Optional[str] = None
    stream_url: Optional[str] = None
    title: Optional[str] = None


class TikTokClient:
    """Petit client HTTP autour des endpoints web de TikTok."""

    def __init__(self, sessionid: str = "", timeout: int = 15) -> None:
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": _UA,
                "Referer": "https://www.tiktok.com/",
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "en-US,en;q=0.9",
            }
        )
        if sessionid:
            self.session.cookies.set("sessionid", sessionid, domain=".tiktok.com")

    # -- bas niveau ---------------------------------------------------------

    def _get_json(self, url: str, params: Optional[dict] = None) -> dict:
        try:
            resp = self.session.get(url, params=params, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:  # réseau / HTTP
            raise TikTokError(f"requête échouée: {url} ({exc})") from exc
        except ValueError as exc:  # JSON invalide
            raise TikTokError(f"réponse JSON invalide depuis {url} ({exc})") from exc

    # -- API publique -------------------------------------------------------

    @staticmethod
    def normalize_username(username: str) -> str:
        """Nettoie un pseudo : retire le @, les espaces, une éventuelle URL."""
        u = username.strip()
        m = re.search(r"tiktok\.com/@([\w.\-]+)", u)
        if m:
            return m.group(1)
        return u.lstrip("@").strip()

    def get_room_id(self, username: str) -> Optional[str]:
        """Récupère le room_id d'un utilisateur, ou None s'il n'a jamais de room."""
        username = self.normalize_username(username)
        data = self._get_json(
            "https://www.tiktok.com/api-live/user/room/",
            params={"aid": 1988, "sourceType": 54, "uniqueId": username},
        )
        room_id = (data.get("data", {}).get("user", {}) or {}).get("roomId")
        if room_id and str(room_id) != "0":
            return str(room_id)

        # Repli : extraction depuis le HTML de la page /live
        return self._room_id_from_html(username)

    def _room_id_from_html(self, username: str) -> Optional[str]:
        try:
            resp = self.session.get(
                f"https://www.tiktok.com/@{username}/live", timeout=self.timeout
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            raise TikTokError(f"impossible de charger la page live de @{username} ({exc})") from exc

        m = re.search(r'"roomId":"(\d+)"', resp.text)
        if m:
            return m.group(1)
        return None

    def get_room_info(self, room_id: str) -> dict:
        """Renvoie le bloc ``data`` de l'endpoint room/info pour un room_id."""
        data = self._get_json(
            "https://webcast.tiktok.com/webcast/room/info/",
            params={"aid": 1988, "room_id": room_id},
        )
        return data.get("data", {}) or {}

    @staticmethod
    def extract_stream_url(room_info: dict) -> Optional[str]:
        """Sélectionne la meilleure URL de flux disponible (FLV > HLS)."""
        stream = room_info.get("stream_url", {}) or {}

        flv = stream.get("flv_pull_url", {}) or {}
        for quality in ("FULL_HD1", "HD1", "SD2", "SD1"):
            if flv.get(quality):
                return flv[quality]
        if flv:
            return next(iter(flv.values()))

        if stream.get("rtmp_pull_url"):
            return stream["rtmp_pull_url"]

        hls = stream.get("hls_pull_url_map", {}) or {}
        for quality in ("FULL_HD1", "HD1", "SD2", "SD1"):
            if hls.get(quality):
                return hls[quality]
        if stream.get("hls_pull_url"):
            return stream["hls_pull_url"]

        return None

    def check_live(self, username: str) -> LiveInfo:
        """Vérifie si ``username`` est en live et renvoie les infos associées."""
        username = self.normalize_username(username)
        room_id = self.get_room_id(username)
        if not room_id:
            return LiveInfo(username=username, is_live=False)

        info = self.get_room_info(room_id)
        status = info.get("status")
        is_live = status == STATUS_LIVE
        return LiveInfo(
            username=username,
            is_live=is_live,
            room_id=room_id,
            stream_url=self.extract_stream_url(info) if is_live else None,
            title=info.get("title"),
        )
