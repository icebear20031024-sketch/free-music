import { useState, useEffect } from 'react';
import localforage from 'localforage';
import { Song, LyricLine } from '../types';
import { api } from '../services/api';

export interface DownloadedSong extends Song {
  downloadedAt: number;
}

const db = localforage.createInstance({
  name: 'music_player',
  storeName: 'downloads'
});

export function useDownloads() {
  const [downloads, setDownloads] = useState<DownloadedSong[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    loadDownloads();
  }, []);

  const loadDownloads = async () => {
    try {
      const keys = await db.keys();
      const songs: DownloadedSong[] = [];
      for (const key of keys) {
        if (key.startsWith('song_meta_')) {
          const meta = await db.getItem<DownloadedSong>(key);
          if (meta) songs.push(meta);
        }
      }
      setDownloads(songs.sort((a, b) => b.downloadedAt - a.downloadedAt));
    } catch (err) {
      console.error('Failed to load downloads', err);
    }
  };

  const downloadSong = async (song: Song, quality?: string) => {
    if (downloadingIds.has(song.id)) return false;
    
    setDownloadingIds(prev => {
      const next = new Set(prev);
      next.add(song.id);
      return next;
    });

    try {
      // Always query a live URL matching the target quality description
      const url = await api.getMediaUrl(song, quality);
      if (!url) throw new Error('No URL found');

      // Fetch lyrics
      const lyrics = await api.getLyrics(song).catch(() => []);

      // Use our backend proxy to avoid CORS issues, but check if it's already a proxy or relative URL
      let proxyUrl = url;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
      }
      const response = await fetch(proxyUrl);
      if (!response.ok) throw new Error('Failed to fetch audio data from proxy');
      
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      
      let loaded = 0;
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          loaded += value.length;
          if (total) {
            setDownloadProgress(prev => ({
              ...prev,
              [song.id]: Math.round((loaded / total) * 100)
            }));
          }
        }
      }
      
      const contentType = response.headers.get('content-type') || '';
      let extension = 'mp3';
      const q = quality || localStorage.getItem('music_audio_quality') || 'standard';
      
      if (contentType.includes('flac')) {
        extension = 'flac';
      } else if (contentType.includes('wav')) {
        extension = 'wav';
      } else if (contentType.includes('m4a') || contentType.includes('x-m4a') || contentType.includes('mp4')) {
        extension = 'm4a';
      } else if (q === 'flac') {
        extension = 'flac';
      } else if (q === 'wav') {
        extension = 'wav';
      }
      
      const blob = new Blob(chunks, { type: contentType || 'audio/mpeg' });
      
      // Trigger actual browser download to user's file system
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      const safeTitle = (song.title || 'Unknown').replace(/[<>:"/\\|?*]/g, '');
      const safeArtist = (song.artist || 'Unknown').replace(/[<>:"/\\|?*]/g, '');
      a.download = `${safeArtist} - ${safeTitle}.${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      const downloadedSong: DownloadedSong = { ...song, downloadedAt: Date.now() };
      
      await db.setItem(`song_file_${song.id}`, blob);
      await db.setItem(`song_meta_${song.id}`, downloadedSong);
      await db.setItem(`song_lyric_${song.id}`, lyrics);
      
      await loadDownloads();
      return true;
    } catch (e: unknown) {
      console.error('Download failed:', e);
      throw e;
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(song.id);
        return next;
      });
      setDownloadProgress(prev => {
        const next = { ...prev };
        delete next[song.id];
        return next;
      });
    }
  };

  const removeDownload = async (id: string) => {
    try {
      await db.removeItem(`song_file_${id}`);
      await db.removeItem(`song_meta_${id}`);
      await db.removeItem(`song_lyric_${id}`);
      await loadDownloads();
    } catch (e) {
      console.error('Failed to remove download', e);
    }
  };

  const isDownloaded = (id: string) => downloads.some(d => d.id === id);
  const isDownloading = (id: string) => downloadingIds.has(id);

  return { downloads, downloadSong, removeDownload, isDownloaded, isDownloading, downloadProgress };
}

export const getLocalAudioUrl = async (id: string): Promise<string | null> => {
  try {
    const blob = await db.getItem<Blob>(`song_file_${id}`);
    if (blob) {
      return URL.createObjectURL(blob);
    }
    return null;
  } catch (e) {
    console.error('Failed to get local audio url', e);
    return null;
  }
};

export const getLocalLyrics = async (id: string): Promise<LyricLine[] | null> => {
  try {
    return await db.getItem<LyricLine[]>(`song_lyric_${id}`);
  } catch (e) {
    console.error('Failed to get local lyrics', e);
    return null;
  }
};
