"""Point d'entrée : ``python -m tikrec``."""

from __future__ import annotations

import logging

from .bot import TikRecBot
from .config import Config
from .recorder import ffmpeg_available


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    config = Config.from_env()
    config.output_dir.mkdir(parents=True, exist_ok=True)

    if not ffmpeg_available():
        logging.getLogger("tikrec").warning(
            "ffmpeg introuvable dans le PATH — les enregistrements échoueront. "
            "Installe-le (ex: `apt install ffmpeg`)."
        )

    bot = TikRecBot(config)
    app = bot.build()
    logging.getLogger("tikrec").info(
        "TikRec démarré — %d pseudo(s) surveillé(s), vérif. toutes les %ds.",
        len(bot.watchlist),
        config.check_interval,
    )
    app.run_polling(allowed_updates=["message"])


if __name__ == "__main__":
    main()
