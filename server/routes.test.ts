import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupRoutes } from './routes';
import { pluginManager } from './plugin-manager';
import { dbService } from './services/db-service';
import { DATA_DIR } from './utils/paths';

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
  let registerHandler: any;
  let loginHandler: any;
  let meHandler: any;
  let playStatsHandler: any;
  let topStatsHandler: any;

  const mockApp = {
    get: vi.fn((path, handler) => {
      if (path === '/api/download') getDownloadHandler = handler;
      if (path === '/api/auth/me') meHandler = handler;
      if (path === '/api/stats/top') topStatsHandler = handler;
    }),
    post: vi.fn((path, handler) => {
      if (path === '/api/download') postDownloadHandler = handler;
      if (path === '/api/auth/register') registerHandler = handler;
      if (path === '/api/auth/login') loginHandler = handler;
      if (path === '/api/stats/play') playStatsHandler = handler;
    }),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clean data files
    const fs = require('fs');
    const path = require('path');
    const uFile = path.join(DATA_DIR, 'users.test.json');
    const pFile = path.join(DATA_DIR, 'play-stats.test.json');
    try { if (fs.existsSync(uFile)) fs.unlinkSync(uFile); } catch (e) {}
    try { if (fs.existsSync(pFile)) fs.unlinkSync(pFile); } catch (e) {}
    (dbService as any).loadData();
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
        'standard',
        expect.any(Boolean)
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

describe('Auth and Stats API Endpoints', () => {
  let registerHandler: any;
  let loginHandler: any;
  let meHandler: any;
  let playStatsHandler: any;
  let topStatsHandler: any;

  const mockApp = {
    get: vi.fn((path, handler) => {
      if (path === '/api/auth/me') meHandler = handler;
      if (path === '/api/stats/top') topStatsHandler = handler;
    }),
    post: vi.fn((path, handler) => {
      if (path === '/api/auth/register') registerHandler = handler;
      if (path === '/api/auth/login') loginHandler = handler;
      if (path === '/api/stats/play') playStatsHandler = handler;
    }),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Clean data files
    const fs = require('fs');
    const path = require('path');
    const uFile = path.join(DATA_DIR, 'users.test.json');
    const pFile = path.join(DATA_DIR, 'play-stats.test.json');
    if (fs.existsSync(uFile)) fs.unlinkSync(uFile);
    if (fs.existsSync(pFile)) fs.unlinkSync(pFile);
    (dbService as any).loadData();
    setupRoutes(mockApp);
  });

  it('should register a new user, login, and verify profile', async () => {
    // 1. Test Register
    const registerReq = {
      body: { username: 'testuser2', password: 'password123', nickname: 'Testy', avatar: '' }
    } as any;
    let regStatus = 0;
    let regJson: any = null;
    const regRes = {
      status: vi.fn().mockImplementation((code) => { regStatus = code; return regRes; }),
      json: vi.fn().mockImplementation((body) => { regJson = body; return regRes; })
    } as any;
    await registerHandler(registerReq, regRes, vi.fn());

    expect(regJson.success).toBe(true);
    expect(regJson.token).toBeDefined();
    expect(regJson.user.username).toBe('testuser2');
    expect(regJson.user.nickname).toBe('Testy');

    const token = regJson.token;

    // 2. Test Login
    const loginReq = {
      body: { username: 'testuser2', password: 'password123' }
    } as any;
    let logStatus = 0;
    let logJson: any = null;
    const logRes = {
      status: vi.fn().mockImplementation((code) => { logStatus = code; return logRes; }),
      json: vi.fn().mockImplementation((body) => { logJson = body; return logRes; })
    } as any;
    await loginHandler(loginReq, logRes, vi.fn());

    expect(logJson.success).toBe(true);
    expect(logJson.token).toBeDefined();
    expect(logJson.user.username).toBe('testuser2');

    // 3. Test Me Profile Retrieve
    const meReq = {
      headers: { authorization: `Bearer ${token}` }
    } as any;
    let meStatus = 0;
    let meJson: any = null;
    const meRes = {
      status: vi.fn().mockImplementation((code) => { meStatus = code; return meRes; }),
      json: vi.fn().mockImplementation((body) => { meJson = body; return meRes; })
    } as any;
    await meHandler(meReq, meRes, vi.fn());

    expect(meJson.success).toBe(true);
    expect(meJson.user.username).toBe('testuser2');
    expect(meJson.user.nickname).toBe('Testy');
  });

  it('should track play stats and retrieve user top list', async () => {
    // Register user to get token
    const registerReq = {
      body: { username: 'musicfan2', password: 'password123', nickname: 'Fan', avatar: '' }
    } as any;
    let regJson: any = null;
    const regRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((body) => { regJson = body; return regRes; })
    } as any;
    await registerHandler(registerReq, regRes, vi.fn());
    const token = regJson.token;

    // 1. Play Song (Anonymous/Guest)
    const playReqGuest = {
      headers: {},
      body: { song: { id: 'songA', sourceId: 'xiaoyun', title: 'Song A', artist: 'Artist X' } }
    } as any;
    let playJsonGuest: any = null;
    const playResGuest = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((body) => { playJsonGuest = body; return playResGuest; })
    } as any;
    await playStatsHandler(playReqGuest, playResGuest, vi.fn());
    expect(playJsonGuest.success).toBe(true);
    expect(playJsonGuest.record.playCount).toBe(1);

    // 2. Play Song (Logged in)
    const playReqUser = {
      headers: { authorization: `Bearer ${token}` },
      body: { song: { id: 'songB', sourceId: 'xiaoyun', title: 'Song B', artist: 'Artist Y' } }
    } as any;
    let playJsonUser: any = null;
    const playResUser = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((body) => { playJsonUser = body; return playResUser; })
    } as any;
    await playStatsHandler(playReqUser, playResUser, vi.fn());
    await playStatsHandler(playReqUser, playResUser, vi.fn()); // Play twice

    expect(playJsonUser.success).toBe(true);
    expect(playJsonUser.record.playCount).toBe(2);

    // 3. Get User Top Stats
    const statsReq = {
      headers: { authorization: `Bearer ${token}` },
      query: { limit: '10' }
    } as any;
    let statsJson: any = null;
    const statsRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockImplementation((body) => { statsJson = body; return statsRes; })
    } as any;
    await topStatsHandler(statsReq, statsRes, vi.fn());

    expect(statsJson.success).toBe(true);
    expect(statsJson.stats.length).toBe(1);
    expect(statsJson.stats[0].songId).toBe('songB');
    expect(statsJson.stats[0].playCount).toBe(2);
  });
});
