import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import { Song, LyricLine } from '../types';
import { api } from '../services/api';
import { getLocalAudioUrl, getLocalLyrics } from '../hooks/useDownloads';

interface PlayerContextType {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  lyrics: LyricLine[];
  showLyricsView: boolean;
  volume: number;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playlist: Song[];
  currentIndex: number;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  playSong: (song: Song, list?: Song[], explicitIndex?: number) => Promise<void>;
  playQueueIndex: (index: number) => void;
  togglePlay: () => void;
  playNext: (autoAdvance?: boolean) => void;
  playPrev: () => void;
  setVolume: (vol: number) => void;
  setShowLyricsView: (show: boolean) => void;
  handleTimeUpdate: () => void;
  handleSeek: (percent: number) => void;
  repeatMode: 'none' | 'all' | 'one';
  setRepeatMode: (mode: 'none' | 'all' | 'one') => void;
  toggleRepeatMode: () => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [showLyricsView, setShowLyricsView] = useState(false);
  const [volume, setVolumeState] = useState(1);
  const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('all');
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleRepeatMode = () => {
    setRepeatMode(prev => prev === 'none' ? 'all' : prev === 'all' ? 'one' : 'none');
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (percent: number) => {
    if (!audioRef.current || !duration) return;
    const newTime = percent * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const setVolume = (vol: number) => {
    const safeVol = Math.max(0, Math.min(1, vol));
    setVolumeState(safeVol);
    if (audioRef.current) {
      audioRef.current.volume = safeVol;
    }
  };

  const playSong = async (song: Song, list?: Song[], explicitIndex?: number) => {
    setCurrentSong(song);
    setIsPlaying(false); // Pause while loading
    setLyrics([]);
    
    if (explicitIndex !== undefined) {
      if (list) setPlaylist(list);
      setCurrentIndex(explicitIndex);
    } else if (list) {
      setPlaylist(list);
      setCurrentIndex(list.findIndex(s => s.id === song.id));
    } else if (playlist.length > 0) {
      setCurrentIndex(playlist.findIndex(s => s.id === song.id));
    }

    try {
      // Check offline storage first
      const localUrl = await getLocalAudioUrl(song.id);
      
      let urlToPlay = localUrl || song.url;
      if (!urlToPlay) {
        try {
          urlToPlay = await api.getMediaUrl(song);
        } catch (err: unknown) {
          if (song.alternativeSources && song.alternativeSources.length > 0) {
            let success = false;
            for (const alt of song.alternativeSources) {
              try {
                const altSong = { ...song, sourceId: alt.sourceId, raw: alt.raw };
                urlToPlay = await api.getMediaUrl(altSong);
                song.sourceId = alt.sourceId;
                song.raw = alt.raw;
                success = true;
                break;
              } catch (e) {}
            }
            if (!success) throw err;
          } else {
            throw err;
          }
        }
        song.url = urlToPlay; // Cache it
      }

      // Load lyrics matching the final source, fallback to alternatives if empty
      const loadLyrics = async () => {
        let lrc = await getLocalLyrics(song.id);
        if (!lrc || lrc.length === 0) {
          lrc = await api.getLyrics(song).catch(() => []);
          
          if (!lrc || lrc.length === 0) {
            // Fallback: try alternative sources for lyrics
            if (song.alternativeSources && song.alternativeSources.length > 0) {
              for (const alt of song.alternativeSources) {
                if (alt.sourceId === song.sourceId) continue; // already tried above
                try {
                  const altSong = { ...song, sourceId: alt.sourceId, raw: alt.raw };
                  const altLrc = await api.getLyrics(altSong);
                  if (altLrc && altLrc.length > 0) {
                    lrc = altLrc;
                    break;
                  }
                } catch (e) {}
              }
            }
          }
        }
        setLyrics(lrc || []);
      };
      loadLyrics();

      if (audioRef.current && urlToPlay) {
        audioRef.current.src = urlToPlay;
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (playErr: unknown) {
          const error = playErr as Error;
          if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
             throw playErr;
          }
        }
      }
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name !== 'AbortError' && error.name !== 'NotAllowedError') {
        console.error("Playback failed:", err);
      }
      setIsPlaying(false);
      // Auto skip to next if failed?
      // playNext();
    }
  };

  const playNext = (autoAdvance = false) => {
    if (autoAdvance && repeatMode === 'one') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
      }
      return;
    }
    
    if (playlist.length > 0 && currentIndex < playlist.length - 1) {
      playSong(playlist[currentIndex + 1], undefined, currentIndex + 1);
    } else if (playlist.length > 0) {
      if (!autoAdvance || repeatMode === 'all') {
        // Loop back to start
        playSong(playlist[0], undefined, 0);
      } else {
        setIsPlaying(false);
      }
    }
  };

  const playPrev = () => {
    if (playlist.length > 0 && currentIndex > 0) {
      playSong(playlist[currentIndex - 1], undefined, currentIndex - 1);
    } else if (playlist.length > 0) {
      // Loop to end
      playSong(playlist[playlist.length - 1], undefined, playlist.length - 1);
    }
  };

  const playQueueIndex = (index: number) => {
    if (index >= 0 && index < playlist.length) {
      playSong(playlist[index], undefined, index);
    }
  };

  const togglePlay = () => {
    if (!currentSong || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlaying(!isPlaying);
  };

  const removeFromQueue = (index: number) => {
    if (index < 0 || index >= playlist.length) return;
    const newPlaylist = [...playlist];
    newPlaylist.splice(index, 1);
    setPlaylist(newPlaylist);
    if (index < currentIndex) {
      setCurrentIndex(currentIndex - 1);
    } else if (index === currentIndex) {
      if (newPlaylist.length === 0) {
        setCurrentSong(null);
        setIsPlaying(false);
        audioRef.current?.pause();
        setCurrentIndex(-1);
      } else {
        // play next
        const nextIndex = index >= newPlaylist.length ? 0 : index;
        playSong(newPlaylist[nextIndex], newPlaylist, nextIndex);
      }
    }
  };

  const clearQueue = () => {
    setPlaylist([]);
    setCurrentIndex(-1);
    setCurrentSong(null);
    setIsPlaying(false);
    audioRef.current?.pause();
  };

  // Sync isPlaying state with actual audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      playNext(true); // Auto play next track
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentIndex, playlist, repeatMode]); // need these dependencies for playNext in onEnded

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input or textarea
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.ctrlKey && e.code === 'ArrowRight') {
        e.preventDefault();
        playNext();
      } else if (e.ctrlKey && e.code === 'ArrowLeft') {
        e.preventDefault();
        playPrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, playNext, playPrev]);

  const value = {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    lyrics,
    showLyricsView,
    volume,
    audioRef,
    playlist,
    currentIndex,
    removeFromQueue,
    clearQueue,
    playSong,
    playQueueIndex,
    togglePlay,
    playNext,
    playPrev,
    setVolume,
    setShowLyricsView,
    handleTimeUpdate,
    handleSeek,
    repeatMode,
    setRepeatMode,
    toggleRepeatMode
  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}

