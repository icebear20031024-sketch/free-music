import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupRoutes } from './routes';
import { pluginManager } from './plugin-manager';

// Mock pluginManager
vi.mock('./plugin-manager', () => ({
  pluginManager: {
    getPlugin: vi.fn(),
    getAllPlugins: vi.fn(() => []),
  }
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Routes /api/download', () => {
  let getDownloadHandler: any;
  let postDownloadHandler: any;

  const mockApp = {
    get: vi.fn((path, handler) => {
      if (path === '/api/download') getDownloadHandler = handler;
    }),
    post: vi.fn((path, handler) => {
      if (path === '/api/download') postDownloadHandler = handler;
    }),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    setupRoutes(mockApp);
  });

  describe('GET /api/download', () => {
    it('should return 400 if sourceId is missing', async () => {
      const req = {
        query: { quality: 'standard' }
      } as any;
      
      let statusCode = 0;
      let jsonBody: any = null;
      const res = {
        status: vi.fn().mockImplementation((code) => {
          statusCode = code;
          return res;
        }),
        json: vi.fn().mockImplementation((body) => {
          jsonBody = body;
          return res;
        })
      } as any;
      const next = vi.fn();

      await getDownloadHandler(req, res, next);

      expect(statusCode).toBe(400);
      expect(jsonBody.success).toBe(false);
      expect(jsonBody.error).toBe('Missing sourceId');
    });

    it('should return 400 if musicItem and id are missing', async () => {
      const req = {
        query: { sourceId: 'xiaoyun' }
      } as any;

      let statusCode = 0;
      let jsonBody: any = null;
      const res = {
        status: vi.fn().mockImplementation((code) => {
          statusCode = code;
          return res;
        }),
        json: vi.fn().mockImplementation((body) => {
          jsonBody = body;
          return res;
        })
      } as any;
      const next = vi.fn();

      await getDownloadHandler(req, res, next);

      expect(statusCode).toBe(400);
      expect(jsonBody.success).toBe(false);
      expect(jsonBody.error).toBe('Missing musicItem or music id');
    });

    it('should trigger direct file streaming with custom headers', async () => {
      const req = {
        query: {
          sourceId: 'xiaoyun',
          id: 'test-song-abc',
          title: '晴天',
          artist: '周杰伦'
        }
      } as any;

      const mockPlugin = {
        getMediaSource: vi.fn().mockResolvedValue({
          url: 'https://test-music-cdn.com/stream.mp3',
          header: { 'X-Custom-Auth': 'SecretSession' }
        })
      };
      vi.mocked(pluginManager.getPlugin).mockReturnValue(mockPlugin as any);

      // Web ReadableStream mock
      const mockStream = {
        pipe: vi.fn()
      };

      const mockResponse = {
        ok: true,
        status: 200,
        headers: {
          get: vi.fn((name) => {
            if (name === 'content-type') return 'audio/mpeg';
            if (name === 'content-length') return '5000000';
            return null;
          })
        },
        body: mockStream
      };
      mockFetch.mockResolvedValue(mockResponse);

      let statusCode = 0;
      const resHeaders: Record<string, string> = {};
      const res = {
        status: vi.fn().mockImplementation((code) => {
          statusCode = code;
          return res;
        }),
        setHeader: vi.fn().mockImplementation((name, value) => {
          resHeaders[name.toLowerCase()] = String(value);
          return res;
        }),
        end: vi.fn()
      } as any;
      const next = vi.fn();

      await getDownloadHandler(req, res, next);

      expect(pluginManager.getPlugin).toHaveBeenCalledWith('xiaoyun');
      expect(mockPlugin.getMediaSource).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-song-abc',
          title: '晴天',
          artist: '周杰伦'
        }),
        'standard'
      );

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-music-cdn.com/stream.mp3',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Auth': 'SecretSession',
            'Referer': 'https://test-music-cdn.com'
          })
        })
      );

      expect(resHeaders['content-type']).toBe('audio/mpeg');
      expect(resHeaders['content-length']).toBe('5000000');
      expect(resHeaders['content-disposition']).toContain("filename*=UTF-8''%E5%91%A8%E6%9D%B0%E4%BC%A6%20-%20%E6%99%B4%E5%A4%A9.mp3");
    });
  });

  describe('POST /api/download', () => {
    it('should return 400 if sourceId is missing in request body', async () => {
      const req = {
        body: { quality: 'standard' }
      } as any;

      let statusCode = 0;
      let jsonBody: any = null;
      const res = {
        status: vi.fn().mockImplementation((code) => {
          statusCode = code;
          return res;
        }),
        json: vi.fn().mockImplementation((body) => {
          jsonBody = body;
          return res;
        })
      } as any;
      const next = vi.fn();

      await postDownloadHandler(req, res, next);

      expect(statusCode).toBe(400);
      expect(jsonBody.success).toBe(false);
      expect(jsonBody.error).toBe('Missing sourceId or musicItem');
    });
  });
});
