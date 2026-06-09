'use strict';

const TelegramBot = require('node-telegram-bot-api');
const TikTokDownloader = require('./downloader');

const MESSAGES = {
  welcome:
    '🎵 *Bienvenue sur TikRec Bot!*\n\n' +
    'Envoyez-moi un lien TikTok et je vous téléchargerai la vidéo *sans filigrane*!\n\n' +
    '*Commandes:*\n' +
    '/start — Démarrer le bot\n' +
    '/help  — Aide\n' +
    '/about — À propos',

  help:
    '📖 *Guide d\'utilisation:*\n\n' +
    '1\\. Copiez un lien TikTok\n' +
    '2\\. Collez\\-le ici\n' +
    '3\\. Recevez la vidéo sans filigrane\\!\n\n' +
    '*Formats supportés:*\n' +
    '• `https://www.tiktok.com/@user/video/123`\n' +
    '• `https://vm.tiktok.com/xxxxx`\n' +
    '• `https://vt.tiktok.com/xxxxx`',

  about:
    'ℹ️ *TikRec Bot*\n\n' +
    'Téléchargez des vidéos TikTok sans filigrane directement dans Telegram\\.\n\n' +
    '_Développé avec ❤️_',

  processing: '⏳ Téléchargement en cours…',

  invalidUrl:
    '❌ Ce n\'est pas un lien TikTok valide\\.\n\n' +
    'Envoyez un lien comme:\n' +
    '`https://www.tiktok.com/@user/video/123`',
};

class TikRecBot {
  constructor(token, options = {}) {
    this.downloader = options.downloader || new TikTokDownloader();
    this.bot =
      options.bot ||
      new TelegramBot(token, { polling: options.noPolling ? false : true });
    this._setupHandlers();
  }

  _setupHandlers() {
    this.bot.onText(/\/start/, (msg) => this._handleStart(msg));
    this.bot.onText(/\/help/, (msg) => this._handleHelp(msg));
    this.bot.onText(/\/about/, (msg) => this._handleAbout(msg));
    this.bot.on('message', (msg) => this._handleMessage(msg));
  }

  async _handleStart(msg) {
    await this.bot.sendMessage(msg.chat.id, MESSAGES.welcome, {
      parse_mode: 'MarkdownV2',
    });
  }

  async _handleHelp(msg) {
    await this.bot.sendMessage(msg.chat.id, MESSAGES.help, {
      parse_mode: 'MarkdownV2',
    });
  }

  async _handleAbout(msg) {
    await this.bot.sendMessage(msg.chat.id, MESSAGES.about, {
      parse_mode: 'MarkdownV2',
    });
  }

  async _handleMessage(msg) {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;

    const tiktokUrl = this.downloader.extractTikTokUrl(text);

    if (!tiktokUrl) {
      await this.bot.sendMessage(chatId, MESSAGES.invalidUrl, {
        parse_mode: 'MarkdownV2',
      });
      return;
    }

    let processingMsg;
    try {
      processingMsg = await this.bot.sendMessage(chatId, MESSAGES.processing);

      const info = await this.downloader.fetchVideoInfo(tiktokUrl);
      const buffer = await this.downloader.downloadVideoBuffer(
        info.hdVideoUrl || info.videoUrl
      );

      await this.bot.deleteMessage(chatId, processingMsg.message_id).catch(() => {});

      await this.bot.sendVideo(chatId, buffer, {
        caption: this._formatCaption(info),
        parse_mode: 'HTML',
        filename: `tiktok_${Date.now()}.mp4`,
      });
    } catch (err) {
      const errText = `❌ Erreur: ${err.message}`;
      if (processingMsg) {
        await this.bot
          .editMessageText(errText, {
            chat_id: chatId,
            message_id: processingMsg.message_id,
          })
          .catch(() => this.bot.sendMessage(chatId, errText));
      } else {
        await this.bot.sendMessage(chatId, errText);
      }
    }
  }

  _formatCaption(info) {
    const parts = [];
    if (info.author) parts.push(`👤 <b>${this._escapeHtml(info.author)}</b>`);
    if (info.description)
      parts.push(`📝 ${this._escapeHtml(info.description.slice(0, 200))}`);

    const stats = [];
    if (info.duration != null) stats.push(`⏱ ${info.duration}s`);
    if (info.likes != null) stats.push(`❤️ ${this._formatNumber(info.likes)}`);
    if (info.views != null) stats.push(`👁 ${this._formatNumber(info.views)}`);
    if (stats.length) parts.push(stats.join(' · '));

    parts.push('\n🤖 <i>TikRec Bot</i>');
    return parts.join('\n');
  }

  _formatNumber(n) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  }

  _escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  stop() {
    return this.bot.stopPolling();
  }
}

module.exports = { TikRecBot, MESSAGES };
