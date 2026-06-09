'use strict';

const TikTokDownloader = require('../downloader');

describe('TikTokDownloader', () => {
  let downloader;
  let mockHttp;

  beforeEach(() => {
    mockHttp = { get: jest.fn() };
    downloader = new TikTokDownloader(mockHttp);
  });

  // ─── isValidTikTokUrl ────────────────────────────────────────────────────────

  describe('isValidTikTokUrl', () => {
    test.each([
      ['www TikTok',  'https://www.tiktok.com/@user/video/7123456789012345678'],
      ['vm short',    'https://vm.tiktok.com/AbCdEfGh/'],
      ['vt short',    'https://vt.tiktok.com/ZSY1234/'],
      ['no subdomain','https://tiktok.com/@user/video/123'],
    ])('accepts valid URL — %s', (_, url) => {
      expect(downloader.isValidTikTokUrl(url)).toBe(true);
    });

    test.each([
      ['YouTube',      'https://www.youtube.com/watch?v=abc'],
      ['random text',  'hello world'],
      ['empty string', ''],
      ['Instagram',    'https://www.instagram.com/p/xyz'],
    ])('rejects invalid URL — %s', (_, url) => {
      expect(downloader.isValidTikTokUrl(url)).toBe(false);
    });
  });

  // ─── extractTikTokUrl ────────────────────────────────────────────────────────

  describe('extractTikTokUrl', () => {
    test('extracts URL embedded in text', () => {
      const text = 'Regarde ça ! https://www.tiktok.com/@user/video/123 incroyable';
      expect(downloader.extractTikTokUrl(text)).toBe(
        'https://www.tiktok.com/@user/video/123'
      );
    });

    test('returns the URL when text is only a URL', () => {
      expect(downloader.extractTikTokUrl('https://vm.tiktok.com/AbCd/')).toBe(
        'https://vm.tiktok.com/AbCd/'
      );
    });

    test('returns null when no TikTok URL is present', () => {
      expect(downloader.extractTikTokUrl('bonjour tout le monde')).toBeNull();
    });

    test('returns null for empty string', () => {
      expect(downloader.extractTikTokUrl('')).toBeNull();
    });
  });

  // ─── fetchVideoInfo ──────────────────────────────────────────────────────────

  describe('fetchVideoInfo', () => {
    const mockApiResponse = {
      code: 0,
      msg: 'success',
      data: {
        play: 'https://cdn.tiktok.com/video.mp4',
        hdplay: 'https://cdn.tiktok.com/video_hd.mp4',
        cover: 'https://cdn.tiktok.com/cover.jpg',
        author: { nickname: 'TestUser', unique_id: 'testuser' },
        title: 'Description de test',
        duration: 15,
        digg_count: 1500,
        play_count: 50000,
        comment_count: 100,
        share_count: 50,
      },
    };

    test('returns correctly shaped video info on success', async () => {
      mockHttp.get.mockResolvedValue({ data: mockApiResponse });

      const info = await downloader.fetchVideoInfo(
        'https://www.tiktok.com/@user/video/123'
      );

      expect(info).toEqual({
        videoUrl:   'https://cdn.tiktok.com/video.mp4',
        hdVideoUrl: 'https://cdn.tiktok.com/video_hd.mp4',
        coverUrl:   'https://cdn.tiktok.com/cover.jpg',
        author:     'TestUser',
        description:'Description de test',
        duration:   15,
        likes:      1500,
        views:      50000,
        comments:   100,
        shares:     50,
      });
    });

    test('calls the tikwm API with correct params', async () => {
      mockHttp.get.mockResolvedValue({ data: mockApiResponse });

      const url = 'https://www.tiktok.com/@user/video/123';
      await downloader.fetchVideoInfo(url);

      expect(mockHttp.get).toHaveBeenCalledWith(
        expect.stringContaining('tikwm.com'),
        expect.objectContaining({ params: { url, hd: 1 } })
      );
    });

    test('falls back to videoUrl when hdplay is absent', async () => {
      const response = {
        code: 0,
        data: { ...mockApiResponse.data, hdplay: undefined },
      };
      mockHttp.get.mockResolvedValue({ data: response });

      const info = await downloader.fetchVideoInfo(
        'https://www.tiktok.com/@user/video/123'
      );
      expect(info.hdVideoUrl).toBe(info.videoUrl);
    });

    test('uses unique_id as author fallback when nickname absent', async () => {
      const response = {
        code: 0,
        data: {
          ...mockApiResponse.data,
          author: { unique_id: 'fallbackId' },
        },
      };
      mockHttp.get.mockResolvedValue({ data: response });

      const info = await downloader.fetchVideoInfo(
        'https://www.tiktok.com/@user/video/123'
      );
      expect(info.author).toBe('fallbackId');
    });

    test('throws with API error message when code !== 0', async () => {
      mockHttp.get.mockResolvedValue({
        data: { code: -1, msg: 'Vidéo introuvable' },
      });

      await expect(
        downloader.fetchVideoInfo('https://www.tiktok.com/invalid')
      ).rejects.toThrow('Vidéo introuvable');
    });

    test('throws default message when API error has no msg', async () => {
      mockHttp.get.mockResolvedValue({ data: { code: -1 } });

      await expect(
        downloader.fetchVideoInfo('https://www.tiktok.com/invalid')
      ).rejects.toThrow('Échec de récupération des informations vidéo');
    });

    test('propagates network error', async () => {
      mockHttp.get.mockRejectedValue(new Error('Network error'));

      await expect(
        downloader.fetchVideoInfo('https://www.tiktok.com/@user/video/123')
      ).rejects.toThrow('Network error');
    });

    test('handles null optional fields gracefully', async () => {
      const response = {
        code: 0,
        data: {
          play: 'https://cdn.tiktok.com/video.mp4',
          author: null,
          title: null,
          duration: null,
          digg_count: null,
          play_count: null,
          comment_count: null,
          share_count: null,
        },
      };
      mockHttp.get.mockResolvedValue({ data: response });

      const info = await downloader.fetchVideoInfo(
        'https://www.tiktok.com/@user/video/123'
      );
      expect(info.author).toBeNull();
      expect(info.description).toBeNull();
    });
  });

  // ─── downloadVideoBuffer ─────────────────────────────────────────────────────

  describe('downloadVideoBuffer', () => {
    test('returns a Buffer', async () => {
      mockHttp.get.mockResolvedValue({ data: Buffer.from('fake video data') });

      const result = await downloader.downloadVideoBuffer(
        'https://cdn.tiktok.com/video.mp4'
      );

      expect(result).toBeInstanceOf(Buffer);
    });

    test('requests arraybuffer response type', async () => {
      mockHttp.get.mockResolvedValue({ data: Buffer.from('') });

      await downloader.downloadVideoBuffer('https://cdn.tiktok.com/video.mp4');

      expect(mockHttp.get).toHaveBeenCalledWith(
        'https://cdn.tiktok.com/video.mp4',
        expect.objectContaining({ responseType: 'arraybuffer' })
      );
    });

    test('propagates download failure', async () => {
      mockHttp.get.mockRejectedValue(new Error('Téléchargement échoué'));

      await expect(
        downloader.downloadVideoBuffer('https://cdn.tiktok.com/video.mp4')
      ).rejects.toThrow('Téléchargement échoué');
    });

    test('wraps response data in Buffer', async () => {
      const fakeData = new ArrayBuffer(8);
      mockHttp.get.mockResolvedValue({ data: fakeData });

      const result = await downloader.downloadVideoBuffer(
        'https://cdn.tiktok.com/video.mp4'
      );
      expect(result).toBeInstanceOf(Buffer);
    });
  });
});
