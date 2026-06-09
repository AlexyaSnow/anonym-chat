"""Persistance de la liste des pseudos surveillés (fichier JSON)."""

from __future__ import annotations

import json
from pathlib import Path


class Watchlist:
    """Ensemble de pseudos surveillés, sauvegardé sur disque.

    Chaque pseudo est associé au chat_id Telegram qui l'a ajouté, afin de
    savoir où envoyer les notifications/enregistrements.
    """

    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self._entries: dict[str, int] = {}
        self.load()

    def load(self) -> None:
        if not self.path.is_file():
            self._entries = {}
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                self._entries = {str(k): int(v) for k, v in data.items()}
            else:
                self._entries = {}
        except (ValueError, OSError):
            self._entries = {}

    def save(self) -> None:
        tmp = self.path.with_suffix(self.path.suffix + ".tmp")
        tmp.write_text(json.dumps(self._entries, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(self.path)

    def add(self, username: str, chat_id: int) -> bool:
        """Ajoute un pseudo. Renvoie False s'il était déjà surveillé."""
        username = username.lower()
        if username in self._entries:
            return False
        self._entries[username] = chat_id
        self.save()
        return True

    def remove(self, username: str) -> bool:
        """Retire un pseudo. Renvoie False s'il n'était pas surveillé."""
        username = username.lower()
        if username not in self._entries:
            return False
        del self._entries[username]
        self.save()
        return True

    def chat_id_for(self, username: str) -> int | None:
        return self._entries.get(username.lower())

    def usernames(self) -> list[str]:
        return sorted(self._entries)

    def items(self) -> list[tuple[str, int]]:
        return sorted(self._entries.items())

    def __contains__(self, username: str) -> bool:
        return username.lower() in self._entries

    def __len__(self) -> int:
        return len(self._entries)
