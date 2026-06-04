import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { usePlaylists } from './usePlaylists';
import { Song } from '../types';

describe('usePlaylists', () => {
  const mockSong: Song = {
    id: 'song1',
    title: '测试歌曲',
    artist: '测试歌手',
    album: '测试专辑',
    cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4',
    source: '测试源',
    duration: 180,
  };

  beforeEach(() => {
    localStorage.clear();
  });

  it('should initialize with default playlist when localStorage is empty', () => {
    const { result } = renderHook(() => usePlaylists());
    expect(result.current.playlists).toHaveLength(1);
    expect(result.current.playlists[0].id).toBe('default');
    expect(result.current.playlists[0].name).toBe('我喜欢的音乐');
    expect(result.current.playlists[0].items).toEqual([]);
  });

  it('should load initial playlists from localStorage', () => {
    const mockPlaylists = [
      { id: 'default', name: '我喜欢的音乐', items: [], createdAt: 123 },
      { id: 'custom', name: '我的歌单', items: [], createdAt: 456 },
    ];
    localStorage.setItem('music_playlists', JSON.stringify(mockPlaylists));

    const { result } = renderHook(() => usePlaylists());
    expect(result.current.playlists).toHaveLength(2);
    expect(result.current.playlists[1].name).toBe('我的歌单');
  });

  it('should create a new playlist', () => {
    const { result } = renderHook(() => usePlaylists());
    act(() => {
      result.current.createPlaylist('新歌单');
    });

    expect(result.current.playlists).toHaveLength(2);
    expect(result.current.playlists[1].name).toBe('新歌单');
    expect(result.current.playlists[1].items).toEqual([]);
  });

  it('should remove a playlist except default one', () => {
    const { result } = renderHook(() => usePlaylists());
    act(() => {
      result.current.createPlaylist('可删除歌单');
    });
    expect(result.current.playlists).toHaveLength(2);

    const customId = result.current.playlists[1].id;

    // Try to remove default playlist
    act(() => {
      result.current.removePlaylist('default');
    });
    expect(result.current.playlists).toHaveLength(2); // default should still exist

    // Remove custom playlist
    act(() => {
      result.current.removePlaylist(customId);
    });
    expect(result.current.playlists).toHaveLength(1);
    expect(result.current.playlists[0].id).toBe('default');
  });

  it('should add a song to the playlist', () => {
    const { result } = renderHook(() => usePlaylists());

    act(() => {
      result.current.addToPlaylist('default', mockSong);
    });

    expect(result.current.playlists[0].items).toHaveLength(1);
    expect(result.current.playlists[0].items[0].id).toBe('song1');

    // Add again to test deduplication
    act(() => {
      result.current.addToPlaylist('default', mockSong);
    });
    expect(result.current.playlists[0].items).toHaveLength(1);
  });

  it('should remove a song from the playlist', () => {
    const { result } = renderHook(() => usePlaylists());

    act(() => {
      result.current.addToPlaylist('default', mockSong);
    });
    expect(result.current.playlists[0].items).toHaveLength(1);

    act(() => {
      result.current.removeFromPlaylist('default', 'song1');
    });
    expect(result.current.playlists[0].items).toHaveLength(0);
  });

  it('should toggle a song in the playlist', () => {
    const { result } = renderHook(() => usePlaylists());

    // First toggle should add the song
    act(() => {
      result.current.toggleInPlaylist('default', mockSong);
    });
    expect(result.current.playlists[0].items).toHaveLength(1);
    expect(result.current.isInPlaylist('default', 'song1')).toBe(true);

    // Second toggle should remove the song
    act(() => {
      result.current.toggleInPlaylist('default', mockSong);
    });
    expect(result.current.playlists[0].items).toHaveLength(0);
    expect(result.current.isInPlaylist('default', 'song1')).toBe(false);
  });
});
