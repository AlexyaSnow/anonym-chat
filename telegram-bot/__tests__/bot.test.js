'use strict';

const { TikRecBot, MESSAGES } = require('../bot');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeMockBot() {
  return {
    onText:          jest.fn(),
    on:              jest.fn(),
    sendMessage:     jest.fn().mockResolvedValue({ message_id: 42 }),
    sendVideo:       jest.fn().mockResolvedValue({ message_id: 43 }),
    deleteMessage:   jest.fn().mockResolvedValue(true),
    editMessageText: jest.fn().mockResolvedValue(true),
    stopPolling:     jest.fn().mockResolvedValue(undefined),
  };
}

function makeMockDownloader() {
  return {
    extractTikTokUrl:   jest.fn(),
    fetchVideoInfo:     jest.fn(),
    downloadVideoBuffer: jest.fn(),
  };
}

function getHandler(mockBot, event, pattern) {
  if (event === 'onText') {
    const call = mockBot.onText.mock.calls.find(
      ([p]) => p.toString().includes(pattern)
    );
    return call ? call[1] : null;
  }
  const call = mockBot.on.mock.calls.find(([e]) => e === event);
  return call ? call[1] : null;
}

const FAKE_TOKEN = 'FAKE_TOKEN_1234';

const sampleVideoInfo = {
  videoUrl:    'https://cdn.tiktok.com/video.mp4',
  hdVideoUrl:  'https://cdn.tiktok.com/video_hd.mp4',
  coverUrl:    'https://cdn.tiktok.com/cover.jpg',
  author:      'TestUser',
  description: 'Vidéo de test',
  duration:    15,
  likes:       1500,
  views:       50000,
  comments:    100,
  shares:      50,
};

// ─── Setup ───────────────────────────────────────────────────────────────────

describe('TikRecBot', () => {
  let mockBot;
  let mockDownloader;
  let tikrecBot;

  beforeEach(() => {
    mockBot = makeMockBot();
    mockDownloader = makeMockDownloader();
    tikrecBot = new TikRecBot(FAKE_TOKEN, {
      bot: mockBot,
      downloader: mockDownloader,
    });
  });

  // ─── Initialization ─────────────────────────────────────────────────────────

  describe('initialization', () => {
    test('registers /start handler via onText', () => {
      const handler = getHandler(mockBot, 'onText', 'start');
      expect(handler).toBeInstanceOf(Function);
    });

    test('registers /help handler via onText', () => {
      const handler = getHandler(mockBot, 'onText', 'help');
      expect(handler).toBeInstanceOf(Function);
    });

    test('registers /about handler via onText', () => {
      const handler = getHandler(mockBot, 'onText', 'about');
      expect(handler).toBeInstanceOf(Function);
    });

    test('registers message handler via on()', () => {
      const handler = getHandler(mockBot, 'message');
      expect(handler).toBeInstanceOf(Function);
    });
  });

  // ─── /start ─────────────────────────────────────────────────────────────────

  describe('/start command', () => {
    test('sends welcome message with MarkdownV2', async () => {
      const handler = getHandler(mockBot, 'onText', 'start');
      await handler({ chat: { id: 100 } });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        100,
        MESSAGES.welcome,
        { parse_mode: 'MarkdownV2' }
      );
    });
  });

  // ─── /help ──────────────────────────────────────────────────────────────────

  describe('/help command', () => {
    test('sends help message with MarkdownV2', async () => {
      const handler = getHandler(mockBot, 'onText', 'help');
      await handler({ chat: { id: 200 } });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        200,
        MESSAGES.help,
        { parse_mode: 'MarkdownV2' }
      );
    });
  });

  // ─── /about ─────────────────────────────────────────────────────────────────

  describe('/about command', () => {
    test('sends about message with MarkdownV2', async () => {
      const handler = getHandler(mockBot, 'onText', 'about');
      await handler({ chat: { id: 300 } });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        300,
        MESSAGES.about,
        { parse_mode: 'MarkdownV2' }
      );
    });
  });

  // ─── Message handler ────────────────────────────────────────────────────────

  describe('message handler', () => {
    let messageHandler;

    beforeEach(() => {
      messageHandler = getHandler(mockBot, 'message');
    });

    test('ignores messages without text', async () => {
      await messageHandler({ chat: { id: 1 } });
      expect(mockDownloader.extractTikTokUrl).not.toHaveBeenCalled();
    });

    test('ignores /start command messages', async () => {
      await messageHandler({ chat: { id: 1 }, text: '/start' });
      expect(mockDownloader.extractTikTokUrl).not.toHaveBeenCalled();
    });

    test('ignores any / command', async () => {
      await messageHandler({ chat: { id: 1 }, text: '/help' });
      expect(mockDownloader.extractTikTokUrl).not.toHaveBeenCalled();
    });

    test('sends invalidUrl when no TikTok URL found', async () => {
      mockDownloader.extractTikTokUrl.mockReturnValue(null);

      await messageHandler({ chat: { id: 1 }, text: 'bonjour !' });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        1,
        MESSAGES.invalidUrl,
        { parse_mode: 'MarkdownV2' }
      );
      expect(mockDownloader.fetchVideoInfo).not.toHaveBeenCalled();
    });

    test('sends processing message then video on success', async () => {
      const fakeBuffer = Buffer.from('video data');
      mockDownloader.extractTikTokUrl.mockReturnValue(
        'https://www.tiktok.com/@user/video/123'
      );
      mockDownloader.fetchVideoInfo.mockResolvedValue(sampleVideoInfo);
      mockDownloader.downloadVideoBuffer.mockResolvedValue(fakeBuffer);

      await messageHandler({
        chat: { id: 1 },
        text: 'https://www.tiktok.com/@user/video/123',
      });

      expect(mockBot.sendMessage).toHaveBeenCalledWith(1, MESSAGES.processing);
      expect(mockBot.deleteMessage).toHaveBeenCalledWith(1, 42);
      expect(mockBot.sendVideo).toHaveBeenCalledWith(
        1,
        fakeBuffer,
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });

    test('passes extracted URL (not raw text) to fetchVideoInfo', async () => {
      const extracted = 'https://www.tiktok.com/@user/video/123';
      mockDownloader.extractTikTokUrl.mockReturnValue(extracted);
      mockDownloader.fetchVideoInfo.mockResolvedValue(sampleVideoInfo);
      mockDownloader.downloadVideoBuffer.mockResolvedValue(Buffer.from(''));

      await messageHandler({
        chat: { id: 1 },
        text: 'Vidéo sympa https://www.tiktok.com/@user/video/123 !!',
      });

      expect(mockDownloader.fetchVideoInfo).toHaveBeenCalledWith(extracted);
    });

    test('edits processing message on fetchVideoInfo failure', async () => {
      mockDownloader.extractTikTokUrl.mockReturnValue(
        'https://www.tiktok.com/@user/video/123'
      );
      mockDownloader.fetchVideoInfo.mockRejectedValue(
        new Error('API indisponible')
      );

      await messageHandler({
        chat: { id: 1 },
        text: 'https://www.tiktok.com/@user/video/123',
      });

      expect(mockBot.editMessageText).toHaveBeenCalledWith(
        '❌ Erreur: API indisponible',
        expect.objectContaining({ chat_id: 1, message_id: 42 })
      );
    });

    test('edits processing message on downloadVideoBuffer failure', async () => {
      mockDownloader.extractTikTokUrl.mockReturnValue(
        'https://www.tiktok.com/@user/video/123'
      );
      mockDownloader.fetchVideoInfo.mockResolvedValue(sampleVideoInfo);
      mockDownloader.downloadVideoBuffer.mockRejectedValue(
        new Error('Téléchargement échoué')
      );

      await messageHandler({
        chat: { id: 1 },
        text: 'https://www.tiktok.com/@user/video/123',
      });

      expect(mockBot.editMessageText).toHaveBeenCalledWith(
        '❌ Erreur: Téléchargement échoué',
        expect.objectContaining({ chat_id: 1, message_id: 42 })
      );
    });

    test('falls back to sendMessage when editMessageText fails', async () => {
      mockDownloader.extractTikTokUrl.mockReturnValue(
        'https://www.tiktok.com/@user/video/123'
      );
      mockDownloader.fetchVideoInfo.mockRejectedValue(new Error('Erreur'));
      mockBot.editMessageText.mockRejectedValue(new Error('edit failed'));

      await messageHandler({
        chat: { id: 1 },
        text: 'https://www.tiktok.com/@user/video/123',
      });

      // sendMessage called at least once after the edit failure
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        1,
        expect.stringContaining('Erreur')
      );
    });

    test('sends error via sendMessage directly when processingMsg is unavailable', async () => {
      mockDownloader.extractTikTokUrl.mockReturnValue(
        'https://www.tiktok.com/@user/video/123'
      );
      // processing sendMessage throws → processingMsg stays undefined
      mockBot.sendMessage.mockRejectedValueOnce(new Error('Telegram down'));
      mockDownloader.fetchVideoInfo.mockRejectedValue(new Error('irrelevant'));

      await messageHandler({
        chat: { id: 1 },
        text: 'https://www.tiktok.com/@user/video/123',
      });

      // The bot should attempt to send the error directly (second sendMessage call)
      const calls = mockBot.sendMessage.mock.calls;
      expect(calls.some(([, text]) => typeof text === 'string' && text.includes('❌'))).toBe(true);
    });

    test('prefers hdVideoUrl over videoUrl for download', async () => {
      const fakeBuffer = Buffer.from('hd video');
      mockDownloader.extractTikTokUrl.mockReturnValue(
        'https://www.tiktok.com/@user/video/123'
      );
      mockDownloader.fetchVideoInfo.mockResolvedValue(sampleVideoInfo);
      mockDownloader.downloadVideoBuffer.mockResolvedValue(fakeBuffer);

      await messageHandler({
        chat: { id: 1 },
        text: 'https://www.tiktok.com/@user/video/123',
      });

      expect(mockDownloader.downloadVideoBuffer).toHaveBeenCalledWith(
        sampleVideoInfo.hdVideoUrl
      );
    });
  });

  // ─── _formatCaption ─────────────────────────────────────────────────────────

  describe('_formatCaption', () => {
    test('includes all fields when present', () => {
      const caption = tikrecBot._formatCaption(sampleVideoInfo);

      expect(caption).toContain('TestUser');
      expect(caption).toContain('Vidéo de test');
      expect(caption).toContain('15s');
      expect(caption).toContain('1.5K');  // likes
      expect(caption).toContain('50.0K'); // views
      expect(caption).toContain('TikRec Bot');
    });

    test('handles missing optional fields gracefully', () => {
      const caption = tikrecBot._formatCaption({});
      expect(caption).toContain('TikRec Bot');
    });

    test('truncates description to 200 chars', () => {
      const longDesc = 'a'.repeat(300);
      const caption = tikrecBot._formatCaption({ description: longDesc });
      const descLine = caption.split('\n').find((l) => l.includes('a'));
      expect(descLine && descLine.replace(/📝 /, '').length).toBeLessThanOrEqual(200);
    });

    test('escapes HTML in author name', () => {
      const caption = tikrecBot._formatCaption({
        author: '<script>alert("xss")</script>',
      });
      expect(caption).not.toContain('<script>');
      expect(caption).toContain('&lt;script&gt;');
    });

    test('escapes HTML in description', () => {
      const caption = tikrecBot._formatCaption({ description: 'a & b < c' });
      expect(caption).toContain('&amp;');
      expect(caption).toContain('&lt;');
    });
  });

  // ─── _formatNumber ──────────────────────────────────────────────────────────

  describe('_formatNumber', () => {
    test.each([
      [1_500_000, '1.5M'],
      [10_000_000, '10.0M'],
      [1_500,     '1.5K'],
      [999,       '999'],
      [0,         '0'],
    ])('formats %d as "%s"', (input, expected) => {
      expect(tikrecBot._formatNumber(input)).toBe(expected);
    });
  });

  // ─── _escapeHtml ────────────────────────────────────────────────────────────

  describe('_escapeHtml', () => {
    test.each([
      ['a & b',      'a &amp; b'],
      ['<div>',      '&lt;div&gt;'],
      ['"quoted"',   '&quot;quoted&quot;'],
      ['no special', 'no special'],
    ])('escapes "%s" → "%s"', (input, expected) => {
      expect(tikrecBot._escapeHtml(input)).toBe(expected);
    });
  });

  // ─── stop ───────────────────────────────────────────────────────────────────

  describe('stop', () => {
    test('calls stopPolling on the underlying bot', () => {
      tikrecBot.stop();
      expect(mockBot.stopPolling).toHaveBeenCalled();
    });
  });
});
