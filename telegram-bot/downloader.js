'use strict';

const axios = require('axios');

const TIKWM_API = 'https://www.tikwm.com/api/';
const TIKTOK_URL_REGEX = /https?:\/\/(www\.|vm\.|vt\.)?tiktok\.com\S+/;

class TikTokDownloader {
  constructor(httpClient = axios) {
    this.http = httpClient;
  }

  isValidTikTokUrl(url) {
    return TIKTOK_URL_REGEX.test(url);
  }

  extractTikTokUrl(text) {
    const match = text.match(TIKTOK_URL_REGEX);
    return match ? match[0] : null;
  }

  async fetchVideoInfo(url) {
    const response = await this.http.get(TIKWM_API, {
      params: { url, hd: 1 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.tikwm.com',
      },
      timeout: 15000,
    });

    const { data } = response;

    if (data.code !== 0) {
      throw new Error(data.msg || 'Échec de récupération des informations vidéo');
    }

    const video = data.data;
    return {
      videoUrl: video.play,
      hdVideoUrl: video.hdplay || video.play,
      coverUrl: video.cover,
      author: video.author?.nickname || video.author?.unique_id || null,
      description: video.title || null,
      duration: video.duration || null,
      likes: video.digg_count || null,
      views: video.play_count || null,
      comments: video.comment_count || null,
      shares: video.share_count || null,
    };
  }

  async downloadVideoBuffer(videoUrl) {
    const response = await this.http.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.tiktok.com',
      },
      maxContentLength: 50 * 1024 * 1024,
    });
    return Buffer.from(response.data);
  }
}

module.exports = TikTokDownloader;
