"""Enregistrement d'un flux de live via ffmpeg."""

from __future__ import annotations

import shutil
import subprocess
import time
from datetime import datetime
from pathlib import Path
from typing import Optional


class FFmpegNotFound(RuntimeError):
    """ffmpeg est introuvable dans le PATH."""


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def _safe_name(value: str) -> str:
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in value)


class Recording:
    """Un enregistrement ffmpeg en cours pour un pseudo donné.

    On copie les flux sans réencodage (``-c copy``) pour rester léger en CPU.
    Le format ``mp4`` avec ``+faststart`` produit un fichier lisible.
    """

    def __init__(self, username: str, stream_url: str, output_dir: Path) -> None:
        self.username = username
        self.stream_url = stream_url
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.path = self.output_dir / f"{_safe_name(username)}_{stamp}.mp4"
        self.started_at = time.time()
        self._proc: Optional[subprocess.Popen] = None

    def start(self) -> None:
        if not ffmpeg_available():
            raise FFmpegNotFound("ffmpeg est requis mais introuvable dans le PATH.")

        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "warning",
            "-reconnect", "1",
            "-reconnect_streamed", "1",
            "-reconnect_delay_max", "5",
            "-i", self.stream_url,
            "-c", "copy",
            "-movflags", "+faststart",
            "-y",
            str(self.path),
        ]
        self._proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    @property
    def is_running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    @property
    def duration(self) -> float:
        return time.time() - self.started_at

    @property
    def size_bytes(self) -> int:
        try:
            return self.path.stat().st_size
        except OSError:
            return 0

    def stop(self, timeout: float = 10.0) -> None:
        """Arrête proprement ffmpeg (envoi de 'q'), avec repli sur kill."""
        if self._proc is None:
            return
        if self._proc.poll() is None:
            try:
                if self._proc.stdin:
                    self._proc.stdin.write(b"q")
                    self._proc.stdin.flush()
            except (BrokenPipeError, OSError):
                pass
            try:
                self._proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                self._proc.terminate()
                try:
                    self._proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self._proc.kill()
        if self._proc.stdin:
            try:
                self._proc.stdin.close()
            except OSError:
                pass
