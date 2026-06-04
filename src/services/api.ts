import { Song, LyricLine } from '../types';

export function getProxiedCoverUrl(url: string | undefined): string {
  const fallback = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80';
  if (!url) return fallback;
  let strUrl = String(url).trim();
  if (!strUrl) return fallback;
  
  if (strUrl.startsWith('//')) {
    strUrl = 'https:' + strUrl;
  }
  
  if (strUrl.startsWith('http://') || strUrl.startsWith('https://')) {
    if (strUrl.includes('/api/proxy?url=')) return strUrl;
    if (strUrl.includes('unsplash.com')) return strUrl;
    return `/api/proxy?url=${encodeURIComponent(strUrl)}`;
  }
  return strUrl;
}

class ApiServer {
  async search(query: string, sources?: string[]): Promise<Song[]> {
    const sParam = sources && sources.length > 0 ? `&sources=${encodeURIComponent(sources.join(','))}` : '';
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}${sParam}`);
    if (!res.ok) throw new Error('Search request failed');
    const data = await res.json();
    
    if (!data.success) {
      throw new Error(data.error || 'Unknown search error');
    }

    const formattedResults: Song[] = [];
    data.results.forEach((pluginResult: { data: unknown[], platform: string, sourceId: string }) => {
      if (pluginResult.data && Array.isArray(pluginResult.data)) {
        pluginResult.data.forEach((item: unknown) => {
          const songData = item as Record<string, unknown>;
          formattedResults.push({
            id: String(songData.id || songData.songmid || songData.hash || Math.random()),
            title: String(songData.title || songData.name || 'Unknown'),
            artist: String(songData.artist || songData.singer || 'Unknown'),
            album: String(songData.album || 'Unknown'),
            cover: getProxiedCoverUrl(String(songData.artwork || songData.pic || songData.coverImg || '')),
            duration: Number(songData.duration || songData.interval || songData.time || songData.dt || 0),
            source: pluginResult.platform || pluginResult.sourceId,
            sourceId: pluginResult.sourceId,
            raw: songData
          });
        });
      }
    });
    
    return formattedResults;
  }

  searchStream(query: string, type: string, onData: (results: unknown[]) => void, signal?: AbortSignal, sources?: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const sParam = sources && sources.length > 0 ? `&sources=${encodeURIComponent(sources.join(','))}` : '';
      const eventSource = new EventSource(`/api/search/stream?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}${sParam}`);
      
      if (signal) {
        signal.addEventListener('abort', () => {
          eventSource.close();
          reject(new Error('AbortError'));
        });
      }

      eventSource.onmessage = (event) => {
        try {
          const pluginResult = JSON.parse(event.data);
          if (pluginResult.data && Array.isArray(pluginResult.data)) {
            if (type === 'music') {
              const formattedResults: Song[] = [];
              pluginResult.data.forEach((item: unknown) => {
                const songData = item as Record<string, unknown>;
                formattedResults.push({
                  id: String(songData.id || songData.songmid || songData.hash || Math.random()),
                  title: String(songData.title || songData.name || 'Unknown'),
                  artist: String(songData.artist || songData.singer || 'Unknown'),
                  album: String(songData.album || 'Unknown'),
                  cover: getProxiedCoverUrl(String(songData.artwork || songData.pic || songData.coverImg || '')),
                  duration: Number(songData.duration || songData.interval || songData.time || songData.dt || 0),
                  source: pluginResult.platform || pluginResult.sourceId,
                  sourceId: pluginResult.sourceId,
                  raw: songData
                });
              });
              onData(formattedResults);
            } else {
              // Pass raw results for artist/sheet/album, plus inject source information
              const formattedResults = pluginResult.data.map((item: unknown) => {
                const dataItem = typeof item === 'object' && item !== null ? item : {};
                return {
                  ...dataItem,
                  source: pluginResult.platform || pluginResult.sourceId,
                  sourceId: pluginResult.sourceId
                };
              });
              onData(formattedResults);
            }
          }
        } catch (e) {
          console.error('Failed to parse SSE data', e);
        }
      };

      let isResolved = false;

      eventSource.addEventListener('end', () => {
        isResolved = true;
        eventSource.close();
        resolve();
      });

      eventSource.onerror = (err) => {
        eventSource.close();
        if (!isResolved) {
          isResolved = true;
          // Resolve gracefully instead of throwing error if the stream closes unexpectedly
          resolve(); 
        }
      };
    });
  }

  async invokePluginMethod(sourceId: string, method: string, args: unknown[]): Promise<unknown> {
    const res = await fetch(`/api/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceId, method, args })
    });
    if (!res.ok) throw new Error(`Failed to invoke ${method}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  }

  async getMediaUrl(song: Song, quality?: string): Promise<string> {
    const q = quality || localStorage.getItem('music_audio_quality') || 'standard';
    const res = await fetch(`/api/play`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceId: song.sourceId,
        musicItem: song.raw,
        quality: q
      })
    });
    if (!res.ok) throw new Error('Failed to fetch media url');
    const data = await res.json();
    if (data.success && data.url) {
      if (data.url.startsWith('http://') || data.url.startsWith('https://')) {
        return `/api/proxy?url=${encodeURIComponent(data.url)}`;
      }
      return data.url;
    }
    throw new Error(data.error || 'Media URL not found in response');
  }

  async getLyrics(song: Song): Promise<LyricLine[]> {
    const res = await fetch(`/api/lyric`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceId: song.sourceId,
        musicItem: song.raw
      })
    });
    if (!res.ok) throw new Error('Failed to fetch lyrics');
    const lrcData = await res.json();
    
    if (lrcData.success) {
      const raw = lrcData.rawLrc || lrcData.lyric || lrcData.lrc || lrcData.lyrics;
      const translationRaw = lrcData.translation || lrcData.tlyric;
      if (raw) {
        const lyricLines = this.parseLyric(raw);
        if (translationRaw) {
          const transLines = this.parseLyric(translationRaw);
          lyricLines.forEach(line => {
            let bestMatch: LyricLine | null = null;
            let minDiff = 0.5; // max 500ms alignment window
            for (const t of transLines) {
              const diff = Math.abs(t.time - line.time);
              if (diff < minDiff) {
                minDiff = diff;
                bestMatch = t;
              }
            }
            if (bestMatch) {
              line.translation = bestMatch.text;
            }
          });
        }
        return lyricLines;
      }
    }
    return [];
  }

  private parseLyric(lrc: string): LyricLine[] {
    const lines = lrc.split('\n');
    const result: LyricLine[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const timeExp = /\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g;
      const text = line.replace(timeExp, '').trim();
      let match;
      while ((match = timeExp.exec(line)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = match[3] ? parseInt(match[3], 10) : 0;
        const time = minutes * 60 + seconds + milliseconds / (match[3] && match[3].length === 3 ? 1000 : 100);
        if (text) {
          result.push({ time, text });
        }
      }
    }
    return result.sort((a, b) => a.time - b.time);
  }
}

export const api = new ApiServer();
