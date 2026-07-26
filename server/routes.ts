import { Express, Request, Response, NextFunction } from 'express';
import { pluginManager } from './plugin-manager.js';
import { logger } from './utils/logger.js';
import { Readable } from 'stream';
import { musicService, withTimeout } from './services/music-service.js';
import { dbService } from './services/db-service.js';

const getUsernameFromRequest = (req: Request): string | null => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return dbService.verifyToken(token);
  }
  return null;
};

async function resolveMediaSource(sourceId: string, musicItem: any, quality: string, refresh = false) {
  const failedSources = new Set<string>(); // permanently failed (rate-limited, auth error, etc.)

  async function tryGetUrl(
    pluginId: string,
    item: any,
    q: string,
    timeoutMs = 6000
  ): Promise<{ mediaRes: { url?: string; header?: Record<string, string> }; resolvedItem: any; resolvedSourceId: string } | null> {
    if (failedSources.has(pluginId)) return null;
    try {
      const plugin = pluginManager.getPlugin(pluginId);
      if (!plugin?.getMediaSource) return null;
      const mediaRes = await withTimeout<{ url?: string; header?: Record<string, string> }>(
        plugin.getMediaSource(item, q, refresh),
        timeoutMs,
        `getMediaSource timeout`
      );
      if (mediaRes?.url) return { mediaRes, resolvedItem: item, resolvedSourceId: pluginId };
    } catch (err: any) {
      const msg = err.message || '';
      logger.warn(`${pluginId} failed for "${musicItem.title || musicItem.id}" (q=${q}): ${msg}`);
      // Rate-limit and auth errors are permanent for this request
      const isPermanent = msg.includes('禁止') || msg.includes('批量') || msg.includes('授权') ||
        msg.includes('Forbidden') || msg.includes('401') || msg.includes('403');
      if (isPermanent) failedSources.add(pluginId);
    }
    return null;
  }

  // Qualities to try. If lossless fails everywhere, retry with standard.
  const qualitiesToTry = (quality === 'wav' || quality === 'flac') ? [quality, 'standard'] : [quality];

  for (const q of qualitiesToTry) {
    if (q !== quality) {
      logger.info(`Quality "${quality}" failed — retrying with "${q}"`);
    }

    // 1. Primary source
    const primary = await tryGetUrl(sourceId, musicItem, q);
    if (primary) return primary;

    // 2. Explicit alternative sources bundled in the music item.
    //    These are pre-verified sources for the SAME song, so they are safe to use.
    if (musicItem.alternativeSources?.length > 0) {
      for (const alt of musicItem.alternativeSources) {
        const altItem = alt.raw || { id: alt.id };
        const res = await tryGetUrl(alt.sourceId, altItem, q, 6000);
        if (res) {
          const title = musicItem.title || musicItem.name;
          const artist = musicItem.artist || musicItem.singer;
          res.resolvedItem = altItem.title ? altItem : { ...altItem, title, artist };
          logger.info(`Alt source ${alt.sourceId} succeeded (q=${q})`);
          return res;
        }
      }
    }

    // 3. Automated fallback: Search other active plugins for title + artist
    try {
      const searchTitle = musicItem.title || musicItem.name;
      const searchArtist = musicItem.artist || musicItem.singer;
      if (searchTitle) {
        const query = `${searchTitle} ${searchArtist || ''}`.trim();
        logger.info(`Primary & alt sources failed for "${searchTitle}" — searching fallback sources for "${query}"`);
        const searchResults = await musicService.searchMusic(query, 1);
        if (searchResults && searchResults.length > 0) {
          for (const pluginResult of searchResults) {
            if (pluginResult.sourceId === sourceId || !pluginResult.data || !Array.isArray(pluginResult.data)) continue;
            for (const item of pluginResult.data as any[]) {
              const candidateItem = item || {};
              const fallbackRes = await tryGetUrl(pluginResult.sourceId, candidateItem, q, 6000);
              if (fallbackRes) {
                logger.info(`Fallback search on ${pluginResult.sourceId} succeeded for "${searchTitle}"`);
                return fallbackRes;
              }
            }
          }
        }
      }
    } catch (fallbackErr) {
      logger.warn(`Fallback search error for "${musicItem.title}": ${fallbackErr}`);
    }
  }

  throw new Error(`Cannot play "${musicItem.title || musicItem.id}" — no sources available`);
}

export function setupRoutes(app: Express) {
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      app: 'music',
      plugins: pluginManager.getPluginIds(),
      time: Date.now(),
    });
  });

  app.post('/api/log-client-error', (req: Request, res: Response) => {
    logger.error('[Client Error]:', req.body);
    res.json({ success: true });
  });
  
  app.get('/api/search', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query.q as string;
      const page = parseInt(req.query.page as string || '1', 10);
      const sourcesParam = req.query.sources as string | undefined;
      const sources = sourcesParam ? sourcesParam.split(',') : undefined;
      
      if (!query) {
        return res.status(400).json({ success: false, error: 'Missing search query' });
      }

      const results = await musicService.searchMusic(query, page, sources);

      res.json({ success: true, results });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/play', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceId, musicItem, quality, refresh } = req.body;
      
      if (!sourceId || !musicItem) {
        return res.status(400).json({ success: false, error: 'Missing sourceId or musicItem' });
      }

      const requestedQuality = quality || 'standard';
      // Use resolveMediaSource which includes fallback to alternative sources and search
      const { mediaRes } = await resolveMediaSource(sourceId as string, musicItem, requestedQuality, !!refresh);
      res.json({ success: true, ...mediaRes });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/lyric', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceId, musicItem } = req.body;
      
      if (!sourceId || !musicItem) {
        return res.status(400).json({ success: false, error: 'Missing sourceId or musicItem' });
      }

      const plugin = pluginManager.getPlugin(sourceId as string);
      if (!plugin) {
        return res.status(404).json({ success: false, error: 'Plugin not found' });
      }
      if (!plugin.getLyric) {
        return res.status(400).json({ success: false, error: 'Plugin does not support lyrics' });
      }

      const lyricRes = await withTimeout<unknown>(
        plugin.getLyric(musicItem),
        5000,
        'Lyric fetch timeout'
      ) as object;
      res.json({ success: true, ...lyricRes });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/search/stream', (req: Request, res: Response) => {
    const query = req.query.q as string;
    const page = parseInt(req.query.page as string || '1', 10);
    const type = req.query.type as string || 'music'; // use type here
    const sourcesParam = req.query.sources as string | undefined;
    const sources = sourcesParam ? sourcesParam.split(',') : undefined;
    
    if (!query) {
      res.status(400).end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    // Flush headers immediately to establish the SSE connection
    res.flushHeaders();
    
    const allPlugins = pluginManager.getAllPlugins();
    const activePlugins = sources && sources.length > 0
      ? allPlugins.filter(([id]) => sources.includes(id))
      : allPlugins;

    Promise.allSettled(
      activePlugins.map(async ([id, plugin]) => {
        try {
          if (!plugin.search || (!plugin.supportedSearchType?.includes(type) && type !== 'music')) {
             res.write(`data: ${JSON.stringify({ sourceId: id, error: `Search type ${type} not supported` })}\n\n`);
             return;
          }
          const pluginRes = await withTimeout<unknown>(
            plugin.search(query, page, type),
            8000,
            'Search timeout'
          ) as { data?: unknown[]; isEnd?: boolean };
          
          res.write(`data: ${JSON.stringify({
              sourceId: id,
              platform: plugin.platform || id,
              data: pluginRes?.data || [],
              isEnd: pluginRes?.isEnd
          })}\n\n`);
        } catch (e: unknown) {
             const errorMsg = e instanceof Error ? e.message : String(e);
             res.write(`data: ${JSON.stringify({ sourceId: id, error: errorMsg })}\n\n`);
        }
      })
    ).then(() => {
        res.write(`event: end\ndata: {}\n\n`);
        res.end();
    });
  });

  app.post('/api/invoke', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceId, method, args } = req.body;
      
      if (!sourceId || !method) {
        return res.status(400).json({ success: false, error: 'Missing sourceId or method' });
      }

      const plugin = pluginManager.getPlugin(sourceId as string);
      if (!plugin) {
        return res.status(404).json({ success: false, error: 'Plugin not found' });
      }

      if (typeof plugin[method] !== 'function') {
        return res.status(400).json({ success: false, error: `Method ${method} not found on plugin` });
      }

      const pluginRecord = plugin as Record<string, Function>;
      const invokeRes = await withTimeout<unknown>(
        pluginRecord[method](...args),
        15000,
        `Invoke timeout for ${method}`
      );
      
      res.json({ success: true, data: invokeRes });
    } catch (error: unknown) {
      next(error);
    }
  });

  app.get('/api/proxy', async (req: Request, res: Response, next: NextFunction) => {
    try {
      let targetUrl = req.query.url as string;
      if (!targetUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
      }

      targetUrl = targetUrl.trim();
      let normalizedUrl = targetUrl;
      if (targetUrl.startsWith('//')) {
        normalizedUrl = 'https:' + targetUrl;
      } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        normalizedUrl = 'https://' + targetUrl;
      }

      // Pick a platform-appropriate Referer so CDNs don't reject the request
      let refererValue = 'https://music.163.com';
      try {
        const hostname = new URL(normalizedUrl).hostname;
        if (hostname.includes('kuwo.cn')) {
          refererValue = 'https://www.kuwo.cn';
        } else if (hostname.includes('kugou.com') || hostname.includes('kg.qq.com')) {
          refererValue = 'https://www.kugou.com';
        } else if (hostname.includes('qq.com') || hostname.includes('gtimg.cn')) {
          refererValue = 'https://y.qq.com';
        } else if (hostname.includes('migu.cn') || hostname.includes('cmvideo.cn')) {
          refererValue = 'https://music.migu.cn';
        } else if (hostname.includes('126.net') || hostname.includes('163.com') || hostname.includes('netease.com')) {
          refererValue = 'https://music.163.com';
        } else {
          refererValue = new URL(normalizedUrl).origin;
        }
      } catch (e) {
        // leave default
      }

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': refererValue,
        'Origin': refererValue,
      };

      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      const response = await fetch(normalizedUrl, { headers });

      if (!response.ok && response.status !== 206) {
        return res.status(response.status).json({ error: 'Proxy request failed: ' + response.statusText });
      }

      res.status(response.status);
      res.set({
        'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000'
      });
      
      if (response.headers.has('accept-ranges')) {
        res.set('Accept-Ranges', response.headers.get('accept-ranges') as string);
      }
      if (response.headers.has('content-range')) {
        res.set('Content-Range', response.headers.get('content-range') as string);
      }
      
      // Do NOT forward Content-Length from upstream — the proxied body may be
      // decoded (e.g. gzip decompressed) by Node's fetch, so the upstream
      // Content-Length would be wrong and cause ERR_CONTENT_LENGTH_MISMATCH.
      // Let Node/Express use Transfer-Encoding: chunked instead.

      if (response.body) {
        Readable.fromWeb(response.body as import('stream/web').ReadableStream<Uint8Array>).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/download', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sourceId = req.query.sourceId as string;
      const quality = (req.query.quality as string) || 'standard';
      let filename = req.query.filename as string;
      
      if (!sourceId) {
        return res.status(400).json({ success: false, error: 'Missing sourceId' });
      }

      let musicItem: any = null;
      const musicItemRaw = req.query.musicItem as string;
      if (musicItemRaw) {
        try {
          musicItem = JSON.parse(musicItemRaw);
        } catch (e) {
          return res.status(400).json({ success: false, error: 'Invalid JSON in musicItem parameter' });
        }
      } else {
        const id = req.query.id as string;
        if (!id) {
          return res.status(400).json({ success: false, error: 'Missing musicItem or music id' });
        }
        musicItem = {
          id,
          songId: id,
          mid: req.query.mid as string || id,
          songmid: req.query.songmid as string || id,
          copyrightId: req.query.copyrightId as string || id,
          cid: req.query.cid as string || id,
          hash: req.query.hash as string || id,
          title: req.query.title as string || '',
          artist: req.query.artist as string || '',
          album: req.query.album as string || '',
        };
      }

      const { mediaRes, resolvedItem, resolvedSourceId } = await resolveMediaSource(sourceId, musicItem, quality);

      const targetUrl = mediaRes.url;
      if (!targetUrl) {
        return res.status(500).json({ success: false, error: 'Failed to resolve media URL' });
      }
      const pluginHeaders = mediaRes.header || {};

      // Prepare download filename
      if (!filename) {
        const title = resolvedItem.title || resolvedItem.name || resolvedItem.songName || '';
        const artist = resolvedItem.artist || resolvedItem.singer || '';
        if (title && artist) {
          filename = `${artist} - ${title}.mp3`;
        } else if (title) {
          filename = `${title}.mp3`;
        } else {
          filename = `${resolvedSourceId}_${resolvedItem.id || 'audio'}.mp3`;
        }
      } else if (!filename.includes('.')) {
        filename = `${filename}.mp3`;
      }

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Referer': new URL(targetUrl).origin,
        ...pluginHeaders
      };

      const response = await fetch(targetUrl, { headers });
      if (!response.ok) {
        return res.status(response.status || 500).json({ success: false, error: `Failed to fetch audio stream: ${response.statusText}` });
      }

      res.status(response.status || 200);
      
      const remoteType = response.headers.get('content-type') || 'audio/mpeg';
      const remoteLength = response.headers.get('content-length');

      res.setHeader('Content-Type', remoteType);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      
      if (remoteLength) {
        res.setHeader('Content-Length', remoteLength);
      }

      if (response.body) {
        Readable.fromWeb(response.body as import('stream/web').ReadableStream<Uint8Array>).pipe(res);
      } else {
        res.end();
      }
    } catch (error: any) {
      next(error);
    }
  });

  app.post('/api/download', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceId, musicItem, quality, filename: bodyFilename } = req.body;
      const requestedQuality = quality || 'standard';
      
      if (!sourceId || !musicItem) {
        return res.status(400).json({ success: false, error: 'Missing sourceId or musicItem' });
      }

      const { mediaRes, resolvedItem, resolvedSourceId } = await resolveMediaSource(sourceId, musicItem, requestedQuality);

      const targetUrl = mediaRes.url;
      if (!targetUrl) {
        return res.status(500).json({ success: false, error: 'Failed to resolve media URL' });
      }
      const pluginHeaders = mediaRes.header || {};

      let filename = bodyFilename;
      if (!filename) {
        const title = resolvedItem.title || resolvedItem.name || resolvedItem.songName || '';
        const artist = resolvedItem.artist || resolvedItem.singer || '';
        if (title && artist) {
          filename = `${artist} - ${title}.mp3`;
        } else if (title) {
          filename = `${title}.mp3`;
        } else {
          filename = `${resolvedSourceId}_${resolvedItem.id || 'audio'}.mp3`;
        }
      } else if (!filename.includes('.')) {
        filename = `${filename}.mp3`;
      }

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Referer': new URL(targetUrl).origin,
        ...pluginHeaders
      };

      const response = await fetch(targetUrl, { headers });
      if (!response.ok) {
        return res.status(response.status || 500).json({ success: false, error: `Failed to fetch audio stream: ${response.statusText}` });
      }

      res.status(response.status || 200);
      
      const remoteType = response.headers.get('content-type') || 'audio/mpeg';
      const remoteLength = response.headers.get('content-length');

      res.setHeader('Content-Type', remoteType);
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      
      if (remoteLength) {
        res.setHeader('Content-Length', remoteLength);
      }

      if (response.body) {
        Readable.fromWeb(response.body as import('stream/web').ReadableStream<Uint8Array>).pipe(res);
      } else {
        res.end();
      }
    } catch (error: any) {
      next(error);
    }
  });

  app.get('/api/download/lyric', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sourceId = req.query.sourceId as string;
      let filename = req.query.filename as string;
      
      if (!sourceId) {
        return res.status(400).json({ success: false, error: 'Missing sourceId' });
      }

      let musicItem: any = null;
      const musicItemRaw = req.query.musicItem as string;
      if (musicItemRaw) {
        try {
          musicItem = JSON.parse(musicItemRaw);
        } catch (e) {
          return res.status(400).json({ success: false, error: 'Invalid JSON in musicItem parameter' });
        }
      } else {
        const id = req.query.id as string;
        if (!id) {
          return res.status(400).json({ success: false, error: 'Missing musicItem or music id' });
        }
        musicItem = {
          id,
          songId: id,
          mid: req.query.mid as string || id,
          songmid: req.query.songmid as string || id,
          copyrightId: req.query.copyrightId as string || id,
          cid: req.query.cid as string || id,
          hash: req.query.hash as string || id,
          title: req.query.title as string || '',
          artist: req.query.artist as string || '',
          album: req.query.album as string || '',
        };
      }

      const plugin = pluginManager.getPlugin(sourceId);
      if (!plugin) {
        return res.status(404).json({ success: false, error: 'Plugin not found' });
      }
      if (!plugin.getLyric) {
        return res.status(400).json({ success: false, error: 'Plugin does not support lyrics' });
      }

      const lyricRes = await withTimeout<any>(
        plugin.getLyric(musicItem),
        5000,
        'Lyric fetch timeout'
      );

      const rawLrc = lyricRes ? (lyricRes.rawLrc || lyricRes.lyric || lyricRes.lrc || lyricRes.lyrics || '') : '';
      
      if (!filename) {
        const title = musicItem.title || musicItem.name || musicItem.songName || '';
        const artist = musicItem.artist || musicItem.singer || '';
        if (title && artist) {
          filename = `${artist} - ${title}.lrc`;
        } else if (title) {
          filename = `${title}.lrc`;
        } else {
          filename = `${sourceId}_${musicItem.id || 'lyrics'}.lrc`;
        }
      } else if (!filename.endsWith('.lrc')) {
        filename = filename.replace(/\.[^/.]+$/, "") + '.lrc';
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.send(rawLrc);
    } catch (error: any) {
      next(error);
    }
  });

  app.post('/api/download/lyric', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { sourceId, musicItem, filename: bodyFilename } = req.body;
      
      if (!sourceId || !musicItem) {
        return res.status(400).json({ success: false, error: 'Missing sourceId or musicItem' });
      }

      const plugin = pluginManager.getPlugin(sourceId);
      if (!plugin) {
        return res.status(404).json({ success: false, error: 'Plugin not found' });
      }
      if (!plugin.getLyric) {
        return res.status(400).json({ success: false, error: 'Plugin does not support lyrics' });
      }

      const lyricRes = await withTimeout<any>(
        plugin.getLyric(musicItem),
        5000,
        'Lyric fetch timeout'
      );

      const rawLrc = lyricRes ? (lyricRes.rawLrc || lyricRes.lyric || lyricRes.lrc || lyricRes.lyrics || '') : '';

      let filename = bodyFilename;
      if (!filename) {
        const title = musicItem.title || musicItem.name || musicItem.songName || '';
        const artist = musicItem.artist || musicItem.singer || '';
        if (title && artist) {
          filename = `${artist} - ${title}.lrc`;
        } else if (title) {
          filename = `${title}.lrc`;
        } else {
          filename = `${sourceId}_${musicItem.id || 'lyrics'}.lrc`;
        }
      } else if (!filename.endsWith('.lrc')) {
        filename = filename.replace(/\.[^/.]+$/, "") + '.lrc';
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.send(rawLrc);
    } catch (error: any) {
      next(error);
    }
  });

  // ==========================================
  // Auth Routes
  // ==========================================
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { username, password, nickname, avatar } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    }
    try {
      const user = dbService.createUser(username, password, nickname, avatar);
      const token = dbService.generateToken(username);
      res.json({
        success: true,
        token,
        user: {
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
          createdAt: user.createdAt
        }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: '用户名和密码不能为空' });
    }
    const user = dbService.getUser(username);
    if (!user || dbService.hashPassword(password) !== user.passwordHash) {
      return res.status(401).json({ success: false, error: '用户名或密码错误' });
    }
    const token = dbService.generateToken(username);
    res.json({
      success: true,
      token,
      user: {
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        createdAt: user.createdAt
      }
    });
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const username = getUsernameFromRequest(req);
    if (!username) {
      return res.status(401).json({ success: false, error: '未登录或登录已过期' });
    }
    const user = dbService.getUser(username);
    if (!user) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }
    res.json({
      success: true,
      user: {
        username: user.username,
        nickname: user.nickname,
        avatar: user.avatar,
        createdAt: user.createdAt
      }
    });
  });

  app.post('/api/auth/update', (req: Request, res: Response) => {
    const username = getUsernameFromRequest(req);
    if (!username) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    const { nickname, avatar } = req.body;
    try {
      const user = dbService.updateUserProfile(username, { nickname, avatar });
      res.json({
        success: true,
        user: {
          username: user.username,
          nickname: user.nickname,
          avatar: user.avatar,
          createdAt: user.createdAt
        }
      });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message });
    }
  });

  // ==========================================
  // Play Statistics Routes
  // ==========================================
  app.post('/api/stats/play', (req: Request, res: Response) => {
    const username = getUsernameFromRequest(req);
    const { song } = req.body;
    if (!song || !song.id) {
      return res.status(400).json({ success: false, error: 'Missing song or song.id' });
    }
    try {
      const record = dbService.recordPlay(username, song);
      res.json({ success: true, record });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get('/api/stats/top', (req: Request, res: Response) => {
    const username = getUsernameFromRequest(req);
    if (!username) {
      return res.status(401).json({ success: false, error: '未登录' });
    }
    const limit = parseInt(req.query.limit as string || '50', 10);
    const stats = dbService.getUserStats(username, limit);
    res.json({ success: true, stats });
  });

  app.get('/api/stats/global', (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string || '50', 10);
    const stats = dbService.getGlobalStats(limit);
    res.json({ success: true, stats });
  });

  app.get('/api/stats/song/:id', (req: Request, res: Response) => {
    const username = getUsernameFromRequest(req);
    const songId = req.params.id;
    const counts = dbService.getSongPlayCount(songId, username || undefined);
    res.json({ success: true, ...counts });
  });
}
