import { Express, Request, Response, NextFunction } from 'express';
import { pluginManager } from './plugin-manager.js';
import { logger } from './utils/logger.js';
import { Readable } from 'stream';
import { musicService, withTimeout } from './services/music-service.js';

export function setupRoutes(app: Express) {
  
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
      const { sourceId, musicItem, quality } = req.body;
      
      if (!sourceId || !musicItem) {
        return res.status(400).json({ success: false, error: 'Missing sourceId or musicItem' });
      }

      const plugin = pluginManager.getPlugin(sourceId as string);
      if (!plugin) {
        return res.status(404).json({ success: false, error: 'Plugin not found' });
      }
      if (!plugin.getMediaSource) {
        return res.status(400).json({ success: false, error: 'Plugin does not support playback' });
      }

      const requestedQuality = quality || 'standard';
      const mediaRes = await withTimeout<unknown>(
        plugin.getMediaSource(musicItem, requestedQuality),
        8000,
        'Playback URL fetch timeout'
      ) as object;
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
      const targetUrl = req.query.url as string;
      if (!targetUrl) {
        return res.status(400).json({ error: 'Missing url parameter' });
      }

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
        'Referer': new URL(targetUrl).origin
      };
      
      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      const response = await fetch(targetUrl, { headers });

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
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        res.set('Content-Length', contentLength);
      }

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
          mid: id,
          copyrightId: id,
          title: req.query.title as string || '',
          artist: req.query.artist as string || '',
          album: req.query.album as string || '',
        };
      }

      const plugin = pluginManager.getPlugin(sourceId);
      if (!plugin) {
        return res.status(404).json({ success: false, error: 'Plugin not found' });
      }
      if (!plugin.getMediaSource) {
        return res.status(400).json({ success: false, error: 'Plugin does not support music retrieval' });
      }

      const mediaRes = await withTimeout<{ url?: string; header?: Record<string, string> }>(
        plugin.getMediaSource(musicItem, quality),
        10000,
        'Fetch media source timeout'
      );

      if (!mediaRes || !mediaRes.url) {
        return res.status(404).json({ success: false, error: 'Audio source URL not found' });
      }

      const targetUrl = mediaRes.url;
      const pluginHeaders = mediaRes.header || {};

      // Prepare download filename
      if (!filename) {
        const title = musicItem.title || musicItem.name || musicItem.songName || '';
        const artist = musicItem.artist || musicItem.singer || '';
        if (title && artist) {
          filename = `${artist} - ${title}.mp3`;
        } else if (title) {
          filename = `${title}.mp3`;
        } else {
          filename = `${sourceId}_${musicItem.id || 'audio'}.mp3`;
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

      const plugin = pluginManager.getPlugin(sourceId);
      if (!plugin) {
        return res.status(404).json({ success: false, error: 'Plugin not found' });
      }
      if (!plugin.getMediaSource) {
        return res.status(400).json({ success: false, error: 'Plugin does not support music retrieval' });
      }

      const mediaRes = await withTimeout<{ url?: string; header?: Record<string, string> }>(
        plugin.getMediaSource(musicItem, requestedQuality),
        10000,
        'Fetch media source timeout'
      );

      if (!mediaRes || !mediaRes.url) {
        return res.status(404).json({ success: false, error: 'Audio source URL not found' });
      }

      const targetUrl = mediaRes.url;
      const pluginHeaders = mediaRes.header || {};

      let filename = bodyFilename;
      if (!filename) {
        const title = musicItem.title || musicItem.name || musicItem.songName || '';
        const artist = musicItem.artist || musicItem.singer || '';
        if (title && artist) {
          filename = `${artist} - ${title}.mp3`;
        } else if (title) {
          filename = `${title}.mp3`;
        } else {
          filename = `${sourceId}_${musicItem.id || 'audio'}.mp3`;
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
}
