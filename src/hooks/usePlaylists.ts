import { useState, useEffect } from 'react';
import { Song } from '../types';

export interface Playlist {
  id: string;
  name: string;
  items: Song[];
  createdAt: number;
}

export function usePlaylists() {
  const [playlists, setPlaylists] = useState<Playlist[]>(() => {
    try {
      const stored = localStorage.getItem('music_playlists');
      return stored ? JSON.parse(stored) : [
        { id: 'default', name: '我喜欢的音乐', items: [], createdAt: Date.now() }
      ];
    } catch {
      return [
        { id: 'default', name: '我喜欢的音乐', items: [], createdAt: Date.now() }
      ];
    }
  });

  useEffect(() => {
    localStorage.setItem('music_playlists', JSON.stringify(playlists));
  }, [playlists]);

  const createPlaylist = (name: string, initialItems: Song[] = []) => {
    setPlaylists(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        name,
        items: initialItems,
        createdAt: Date.now()
      }
    ]);
  };

  const removePlaylist = (id: string) => {
    // Keep at least default playlist
    if (id === 'default') return;
    setPlaylists(prev => prev.filter(p => p.id !== id));
  };

  const addToPlaylist = (playlistId: string, song: Song) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        if (p.items.some(s => s.id === song.id)) return p;
        return { ...p, items: [...p.items, song] };
      }
      return p;
    }));
  };

  const removeFromPlaylist = (playlistId: string, songId: string) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        return { ...p, items: p.items.filter(s => s.id !== songId) };
      }
      return p;
    }));
  };

  const toggleInPlaylist = (playlistId: string, song: Song) => {
    setPlaylists(prev => prev.map(p => {
      if (p.id === playlistId) {
        const isExist = p.items.some(s => s.id === song.id);
        if (isExist) {
          return { ...p, items: p.items.filter(s => s.id !== song.id) };
        } else {
          return { ...p, items: [...p.items, song] };
        }
      }
      return p;
    }));
  };

  const isInPlaylist = (playlistId: string, songId: string) => {
    const p = playlists.find(p => p.id === playlistId);
    return p ? p.items.some(s => s.id === songId) : false;
  };

  return { playlists, createPlaylist, removePlaylist, addToPlaylist, removeFromPlaylist, toggleInPlaylist, isInPlaylist };
}
