'use strict';

const { TikRecBot } = require('./bot');

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌  Variable TELEGRAM_BOT_TOKEN manquante.');
  process.exit(1);
}

const bot = new TikRecBot(token);
console.log('✅  TikRec Bot démarré. En attente de messages…');

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
