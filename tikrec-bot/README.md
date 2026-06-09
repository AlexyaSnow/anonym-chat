# 🎬 TikRec — bot Telegram d'enregistrement de lives TikTok

TikRec surveille des comptes TikTok et **enregistre automatiquement leurs lives**
dès qu'ils démarrent. On pilote tout depuis Telegram avec une liste de
surveillance (`/watch`, `/unwatch`).

## Fonctionnement

1. Tu ajoutes un pseudo avec `/watch <pseudo>`.
2. TikRec vérifie régulièrement (toutes les `CHECK_INTERVAL` secondes) si ce
   compte est en live.
3. Dès qu'un live démarre, l'enregistrement commence (via `ffmpeg`, copie du
   flux sans réencodage).
4. À la fin du live, le `.mp4` est livré :
   - **envoyé dans le chat** s'il fait moins de ~50 Mo (limite des bots Telegram) ;
   - sinon une notification indique le **chemin du fichier sur le serveur**.

## Commandes

| Commande | Effet |
|----------|-------|
| `/watch <pseudo>` | Ajoute un pseudo à surveiller (auto-record) |
| `/unwatch <pseudo>` | Retire un pseudo de la surveillance |
| `/list` | Liste les pseudos surveillés |
| `/record <pseudo>` | Enregistre le live **en cours** (ponctuel, hors liste) |
| `/status` | Enregistrements en cours (durée, taille) |
| `/start`, `/help` | Aide |

Les pseudos acceptent `@nom`, `nom`, ou une URL `https://www.tiktok.com/@nom/live`.

## Installation

Prérequis : **Python 3.10+** et **ffmpeg**.

```bash
# ffmpeg (Debian/Ubuntu)
sudo apt update && sudo apt install -y ffmpeg

git clone https://github.com/AlexyaSnow/Tiktok-Bot-.git
cd Tiktok-Bot-
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

## Configuration

Copie `.env.example` en `.env` et renseigne au minimum `BOT_TOKEN` :

```bash
cp .env.example .env
```

| Variable | Rôle |
|----------|------|
| `BOT_TOKEN` | **Obligatoire.** Token du bot (via [@BotFather](https://t.me/BotFather)) |
| `ALLOWED_USERS` | IDs Telegram autorisés, séparés par des virgules (vide = tout le monde) |
| `OUTPUT_DIR` | Dossier des enregistrements (`./recordings` par défaut) |
| `CHECK_INTERVAL` | Intervalle de vérification du live en secondes (min. 15, défaut 60) |
| `TIKTOK_SESSIONID` | Cookie `sessionid` TikTok (optionnel, fiabilise les requêtes) |
| `TELEGRAM_UPLOAD_LIMIT_MB` | Taille max envoyée dans le chat (défaut 49) |

## Lancement

```bash
python -m tikrec
```

## Tests

```bash
pip install pytest
pytest
```

Les tests couvrent la liste de surveillance, le parsing de la configuration,
la normalisation des pseudos et la sélection de l'URL du flux. Ils ne
nécessitent **ni token ni réseau**.

## Notes & limites

- L'enregistrement repose sur les endpoints web publics de TikTok ; ceux-ci
  peuvent changer. Fournir `TIKTOK_SESSIONID` améliore la fiabilité.
- Les bots Telegram ne peuvent pas envoyer de fichiers de plus de 50 Mo : les
  longs lives restent sur le serveur (chemin notifié).
- N'enregistre que des contenus que tu as le droit d'enregistrer ; respecte les
  CGU de TikTok et la vie privée des personnes filmées.
