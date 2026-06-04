import React, { useState, useRef, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { SearchBar } from './components/SearchBar';
import { PlayerBar } from './components/PlayerBar';
import { LyricsView } from './components/LyricsView';
import { PlayerProvider, usePlayer } from './components/PlayerProvider';
import { usePlaylists } from './hooks/usePlaylists';
import { useDownloads } from './hooks/useDownloads';
import { Music, AlertCircle, ArrowUp, ArrowDown, Download, CheckCircle, Trash2, Plus, User, Disc, FileAudio, Folder } from 'lucide-react';
import { Playlist, Song } from './types';
import { api, getProxiedCoverUrl } from './services/api';

type SortField = 'title' | 'artist' | 'duration' | 'downloadedAt' | null;

interface MainContentProps {
  currentView: string;
  setView: (v: string) => void;
  playlists: Playlist[];
  createPlaylist: (name: string) => void;
  removePlaylist: (id: string) => void;
  removeFromPlaylist: (pid: string, sid: string) => void;
}

function MainContent({ currentView, setView, playlists, createPlaylist, removePlaylist, removeFromPlaylist }: MainContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState('music');
  const [searchResults, setSearchResults] = useState<unknown[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorString, setErrorString] = useState<string | null>(null);
  const searchAbortController = useRef<AbortController | null>(null);

  const [selectedSources, setSelectedSources] = useState<string[]>(() => {
    const saved = localStorage.getItem('search_sources');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        // ignore
      }
    }
    return ['xiaoqiu', 'xiaowo', 'xiaoyun', 'xiaogou', 'xiaomi'];
  });

  const handleToggleSource = (id: string) => {
    setSelectedSources(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      const final = next.length > 0 ? next : prev;
      localStorage.setItem('search_sources', JSON.stringify(final));
      return final;
    });
  };
  
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { playSong, currentSong, playlist } = usePlayer();
  const { downloads, downloadSong, removeDownload, isDownloaded, isDownloading, downloadProgress } = useDownloads();

  const handleSearch = async (e?: React.FormEvent, overrideType?: string, overrideQuery?: string) => {
    e?.preventDefault();
    const q = overrideQuery || searchQuery;
    const t = overrideType || searchType;
    if (!q.trim()) return;

    if (searchAbortController.current) {
       searchAbortController.current.abort();
    }
    const abortController = new AbortController();
    searchAbortController.current = abortController;

    setView('search');
    setSearchType(t);
    if (!overrideQuery) {
       setSearchQuery(q);
    }
    setIsSearching(true);
    setSearchResults([]);
    setErrorString(null);
    setSortField(null);
    
    if (t === 'music') {
      const groupedResult = new Map<string, Song>();
      try {
        await api.searchStream(q, t, (newSongs) => {
           let changed = false;
           newSongs.forEach(song => {
              const key = `${song.title}-${song.artist}`.toLowerCase().replace(/\s+/g, '');
              if (groupedResult.has(key)) {
                  const existing = groupedResult.get(key)!;
                  if (!existing.alternativeSources) existing.alternativeSources = [];
                  if (!existing.alternativeSources.some(s => s.source === song.source && s.id === song.id)) {
                     existing.alternativeSources.push({
                        source: song.source,
                        sourceId: song.sourceId!,
                        id: song.id,
                        raw: song.raw
                     });
                  }
              } else {
                 song.alternativeSources = [];
                 groupedResult.set(key, song);
                 changed = true;
              }
           });
           
           if (changed) {
               setSearchResults(Array.from(groupedResult.values()));
           }
        }, abortController.signal, selectedSources);
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message !== 'AbortError') {
          console.error(err);
          setErrorString(error.message || '搜索发生错误，请稍后重试');
        }
      } finally {
        if (searchAbortController.current === abortController) {
          setIsSearching(false);
        }
      }
    } else {
      // artist, album, sheet
      const uniqueResults = new Set();
      const allResults: unknown[] = [];
      try {
        await api.searchStream(q, t, (newItems) => {
           newItems.forEach(item => {
              const rec = item as { id: string };
              const key = rec.id;
              if (!uniqueResults.has(key)) {
                  uniqueResults.add(key);
                  allResults.push(item);
              }
           });
           setSearchResults([...allResults]);
        }, abortController.signal, selectedSources);
      } catch (err: unknown) {
        const error = err as Error;
        if (error.message !== 'AbortError') {
          console.error(err);
          setErrorString(error.message || '搜索发生错误，请稍后重试');
        }
      } finally {
        if (searchAbortController.current === abortController) {
          setIsSearching(false);
        }
      }
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Determine active songs if we are viewing a list of songs
  let activeSongs: Song[] = [];
  const currentPlaylistMatches = currentView.match(/^playlist_(.+)$/);
  if (currentPlaylistMatches) {
     activeSongs = playlists.find((p) => p.id === currentPlaylistMatches[1])?.items || [];
  } else if (currentView === 'downloads') {
     activeSongs = downloads;
  } else if (currentView === 'search' && searchType === 'music') {
     activeSongs = searchResults as Song[];
  } else if (currentView === 'remote_list') {
     activeSongs = searchResults as Song[]; // we'll reuse searchResults to store fetched list
  }

  const getSortedSongs = (songs: Song[]) => {
    if (!sortField) return songs;
    return [...songs].sort((a, b) => {
      let aVal = a[sortField as keyof Song];
      let bVal = b[sortField as keyof Song];

      let cmp = 0;
      if (sortField === 'duration') {
        const aNum = typeof aVal === 'number' ? aVal : (Number(aVal) || 0);
        const bNum = typeof bVal === 'number' ? bVal : (Number(bVal) || 0);
        cmp = aNum - bNum;
      } else if (sortField === 'downloadedAt') {
        const aNum = Number((a as Record<string, unknown>).downloadedAt || 0);
        const bNum = Number((b as Record<string, unknown>).downloadedAt || 0);
        cmp = aNum - bNum;
      } else {
        cmp = String(aVal || '').localeCompare(String(bVal || ''));
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  };

  const sortedSongs = getSortedSongs(activeSongs);

  const formatDuration = (val?: number | string) => {
    const num = Number(val);
    if (!val || isNaN(num)) return '-';
    const seconds = num > 10000 ? Math.floor(num / 1000) : num;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (timestamp?: number | string) => {
    if (!timestamp) return '-';
    // if timestamp is in string format like 2023-01-01
    if (typeof timestamp === 'string' && timestamp.includes('-')) return timestamp;
    const date = new Date(Number(timestamp));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortOrder === 'asc' ? <ArrowUp className="w-4 h-4 ml-1 inline" /> : <ArrowDown className="w-4 h-4 ml-1 inline" />;
  };

  const getViewTitle = () => {
    if (currentPlaylistMatches) {
        const p = playlists.find((x) => x.id === currentPlaylistMatches[1]);
        return p?.name || '歌单';
    }
    if (currentView === 'downloads') return '本地下载';
    if (currentView === 'remote_list') return '列表详情';
    if (searchType === 'music') return '单曲搜索结果';
    if (searchType === 'artist') return '歌手搜索结果';
    if (searchType === 'album') return '专辑搜索结果';
    if (searchType === 'sheet') return '歌单搜索结果';
    return '搜索结果';
  };

  const getEmptyStateText = () => {
    if (currentPlaylistMatches) return '歌单暂无内容';
    if (currentView === 'downloads') return '暂无下载的音乐';
    return '搜你想乐';
  };

  // API wrappers for details
  const loadRemoteList = async (type: string, sourceId: string, item: unknown) => {
      setView('remote_list');
      setIsSearching(true);
      setSearchResults([]);
      setErrorString(null);
      setSortField(null);
      try {
          let list: unknown = null;
          if (type === 'artist') list = await api.invokePluginMethod(sourceId, 'getArtistWorks', [item, 1, 'music']);
          else if (type === 'album') list = await api.invokePluginMethod(sourceId, 'getAlbumInfo', [item, 1]);
          else if (type === 'sheet') list = await api.invokePluginMethod(sourceId, 'getMusicSheetInfo', [item, 1]);
          
          const listRec = list as { musicList?: unknown[]; data?: unknown[] } | unknown[];
          const itemsArray = listRec ? ((!Array.isArray(listRec) && (listRec.musicList || listRec.data)) || (Array.isArray(listRec) ? listRec : [])) : [];
          if (itemsArray && Array.isArray(itemsArray) && itemsArray.length > 0) {
             const itemRec = item as Record<string, unknown>;
             const mapped = itemsArray.map((mItem: unknown) => {
                 const m = mItem as Record<string, unknown>;
                 return {
                 id: String(m.id || m.songmid || m.hash || Math.random()),
                 title: String(m.title || m.name || 'Unknown'),
                 artist: String(m.artist || m.singer || 'Unknown'),
                 album: String(m.album || 'Unknown'),
                 cover: getProxiedCoverUrl(String(m.artwork || m.pic || m.coverImg || itemRec.coverImg || itemRec.avatar || itemRec.artwork || '')),
                 duration: Number(m.duration || m.interval || m.time || m.dt || 0),
                 source: sourceId,
                 sourceId: sourceId,
                 raw: m
                 };
             });
             setSearchResults(mapped);
          } else {
             setSearchResults([]);
             setErrorString("没有找到音乐内容");
          }
      } catch (e: unknown) {
         const error = e as Error;
         setErrorString(error.message || '加载详情失败');
         console.error(e);
      } finally {
         setIsSearching(false);
      }
  };

  const currentPl = currentPlaylistMatches ? playlists.find((p) => p.id === currentPlaylistMatches[1]) : null;

  return (
    <main className="flex-1 flex flex-col min-w-0 relative h-full pb-20">
      <LyricsView />
      
      <div className="flex px-8 py-[18px] border-b border-[#EDEDF2] items-center justify-between z-10 shrink-0 bg-white/90 backdrop-blur-md sticky top-0">
         <SearchBar 
           searchQuery={searchQuery} 
           setSearchQuery={setSearchQuery} 
           onSearch={handleSearch} 
           selectedSources={selectedSources}
           onToggleSource={handleToggleSource}
         />
         {currentView === 'search' && (
           <div className="flex gap-2">
             {['music', 'artist', 'album', 'sheet'].map(type => (
               <button
                 key={type}
                 onClick={() => { setSearchType(type); if(searchQuery) handleSearch(null as unknown as React.FormEvent, type); }}
                 className={`px-4 h-[44px] text-[17px] rounded-full transition-colors flex items-center justify-center ${searchType === type ? 'bg-[#0071E3] text-white font-[600]' : 'hover:bg-[#0071E3]/5 text-[#333336] hover:text-[#0071E3] font-[400]'}`}
               >
                 {type === 'music' ? '单曲' : type === 'artist' ? '歌手' : type === 'album' ? '专辑' : '歌单'}
               </button>
             ))}
           </div>
         )}
      </div>

      <div className="flex-1 overflow-y-auto p-8 relative">
        {isSearching && searchResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#6E6E73]">
             <div className="w-8 h-8 border-[3px] border-[#0071E3]/20 border-t-[#0071E3] rounded-full animate-spin mb-4"></div>
             <p className="text-[17px]">加载中...</p>
          </div>
        ) : errorString ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#e30000]">
            <AlertCircle className="w-10 h-10 mb-4" />
            <p className="text-[17px]">{errorString}</p>
          </div>
        ) : (activeSongs.length > 0 || (currentView === 'search' && searchResults.length > 0)) ? (
          <div>
            <div className="flex items-center gap-3 mb-6">
               <h2 className="text-[28px] leading-[32px] font-[600] text-[#1D1D1F]">
                 {getViewTitle()}
               </h2>
               {isSearching && (
                 <div className="w-5 h-5 border-[2px] border-[#0071E3]/30 border-t-[#0071E3] rounded-full animate-spin mt-1"></div>
               )}
            </div>

            {currentView === 'search' && searchType !== 'music' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {searchResults.map((item, i) => (
                       <div key={item.id || i} 
                            onClick={() => loadRemoteList(searchType, item.sourceId, item)}
                            className="flex flex-col gap-3 group cursor-pointer hover:bg-[#F5F5F7] p-6 rounded-[16px] border border-transparent hover:border-[#EDEDF2] transition-colors">
                           <div className="w-full aspect-square relative rounded-[12px] overflow-hidden bg-[#EDEDF2]">
                              <img src={getProxiedCoverUrl(item.coverImg || item.avatar || item.artwork)} referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80'; }} 
                                   alt={item.title || item.name}
                                   className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${searchType === 'artist' ? 'rounded-full scale-90 group-hover:scale-100 shadow-sm' : ''}`} />
                           </div>
                           <div className="flex flex-col">
                              <span className="text-[17px] leading-[25px] font-[600] text-[#1D1D1F] truncate">{item.title || item.name}</span>
                              <span className="text-[12px] leading-[16px] text-[#6E6E73] truncate mt-1">
                                 {searchType === 'artist' && `歌手 • ${item.worksNum || 0} 张专辑`}
                                 {searchType === 'album' && `${item.artist || '未知'} • ${formatDate(item.date)}`}
                                 {searchType === 'sheet' && `歌单 • ${item.artist || '未知'}`}
                              </span>
                           </div>
                       </div>
                    ))}
                </div>
            ) : (
             <>
                <div className="flex items-center gap-4 py-3 px-2 text-[12px] font-[600] text-[#6E6E73] border-b border-[#EDEDF2] uppercase tracking-wider mb-2">
                  <div className="w-8 text-center text-[12px]">#</div>
                  <div 
                    className="flex-1 min-w-0 cursor-pointer hover:text-[#1D1D1F] select-none"
                    onClick={() => handleSort('title')}
                  >
                    <span>标题</span>
                    <SortIcon field="title" />
                  </div>
                  <div 
                    className="w-1/4 truncate hidden sm:block cursor-pointer hover:text-[#1D1D1F] select-none"
                    onClick={() => handleSort('artist')}
                  >
                    <span>歌手</span>
                    <SortIcon field="artist" />
                  </div>
                  
                  {currentView === 'downloads' ? (
                    <div 
                      className="w-1/4 truncate hidden sm:block cursor-pointer hover:text-[#1D1D1F] select-none"
                      onClick={() => handleSort('downloadedAt')}
                    >
                      <span>下载时间</span>
                      <SortIcon field="downloadedAt" />
                    </div>
                  ) : (
                    <div className="w-1/4 truncate hidden sm:block">
                      <span>专辑</span>
                    </div>
                  )}
                  
                  <div 
                    className="w-16 text-right cursor-pointer hover:text-[#1D1D1F] select-none mr-24"
                    onClick={() => handleSort('duration')}
                  >
                    <span>时长</span>
                    <SortIcon field="duration" />
                  </div>
                </div>
                <div className="grid grid-cols-1 divide-y divide-[#EDEDF2] border-b border-[#EDEDF2]">
                  {sortedSongs.map((song, i) => (
                    <div 
                      key={song.id} 
                      className="flex items-center gap-4 py-[12px] px-2 hover:bg-[#F5F5F7] transition-colors group"
                    >
                      <div className="w-8 text-center text-[#6E6E73] text-[12px] cursor-pointer" onClick={() => playSong(song, sortedSongs)}>
                        {currentSong?.id === song.id ? <div className="text-[#0071E3] text-[12px]">▶</div> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0 flex items-center gap-4 cursor-pointer" onClick={() => playSong(song, sortedSongs)}>
                        <img 
                          src={song.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80&q=80'} 
                          alt={song.title} 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.src = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=80&q=80';
                          }}
                          className="w-11 h-11 object-cover flex-shrink-0 bg-[#EDEDF2] border border-[#rgba(0,0,0,0.05)] shadow-sm"
                        />
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <p className={`font-[600] truncate text-[17px] leading-[25px] ${currentSong?.id === song.id ? 'text-[#0071E3]' : 'text-[#1D1D1F]'}`}>{song.title}</p>
                          <p className="text-[12px] leading-[16px] text-[#6E6E73] sm:hidden truncate">{song.artist} - {song.album}</p>
                        </div>
                      </div>
                      <div className="w-1/4 text-[17px] leading-[25px] text-[#333336] truncate hidden sm:block cursor-pointer font-[400]" onClick={() => playSong(song, sortedSongs)}>
                        {song.artist}
                      </div>

                      {currentView === 'downloads' ? (
                        <div className="w-1/4 text-[17px] leading-[25px] text-[#333336] truncate hidden sm:block cursor-pointer font-[400]" onClick={() => playSong(song, sortedSongs)}>
                          {formatDate((song as Record<string, unknown>).downloadedAt as number | string)}
                        </div>
                      ) : (
                        <div className="w-1/4 text-[17px] leading-[25px] text-[#333336] truncate hidden sm:block cursor-pointer font-[400]" onClick={() => playSong(song, sortedSongs)}>
                          {song.album}
                        </div>
                      )}

                      <div className="w-16 text-right text-[13px] leading-[20px] text-[#6E6E73] font-mono cursor-pointer" onClick={() => playSong(song, sortedSongs)}>
                        {formatDuration(song.duration)}
                      </div>
                      <div className="w-24 flex items-center justify-end gap-3 text-[#6E6E73] shrink-0">
                        {currentPl && currentPl.id !== 'default' && (
                            <button className="hover:text-[#e30000] p-2 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => removeFromPlaylist(currentPl.id, song.id)} title="从歌单移出">
                                <Trash2 className="w-[18px] h-[18px]" />
                            </button>
                        )}
                        {isDownloading(song.id) ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] text-[#0071E3] font-mono w-8 text-right">
                              {downloadProgress[song.id] ?? 0}%
                            </span>
                            <div className="w-4 h-4 border-[2px] border-[#0071E3]/30 border-t-[#0071E3] rounded-full animate-spin"></div>
                          </div>
                        ) : isDownloaded(song.id) ? (
                          <>
                            <CheckCircle className="w-5 h-5 text-[#0071E3]" />
                          </>
                        ) : (
                          <button 
                            className="hover:text-[#0071E3] transition-colors p-2"
                            onClick={(e) => { e.stopPropagation(); downloadSong(song); }}
                            title="下载"
                          >
                            <Download className="w-[20px] h-[20px]" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
             </>
            )}
          </div>
        ) : (
           <div className="flex flex-col items-center justify-center h-full text-[#6E6E73] mt-20">
              <Music className="w-20 h-20 mb-6 opacity-30 stroke-[1.5px]" />
              <p className="text-center font-[400] text-[17px]">
                {getEmptyStateText()}
              </p>
           </div>
        )}
      </div>
    </main>
  );
}

export default function App() {
  const [currentView, setView] = useState('search');
  const playlistHooks = usePlaylists();

  return (
    <PlayerProvider>
      <div className="flex h-screen bg-[#FFFFFF] text-[#1D1D1F] font-sans overflow-hidden">
        <Sidebar currentView={currentView} setView={setView} playlists={playlistHooks.playlists} createPlaylist={playlistHooks.createPlaylist} removePlaylist={playlistHooks.removePlaylist} />
        <MainContent currentView={currentView} setView={setView} {...playlistHooks} />
        <PlayerBar playlists={playlistHooks.playlists} toggleInPlaylist={playlistHooks.toggleInPlaylist} isInPlaylist={playlistHooks.isInPlaylist} />
      </div>
    </PlayerProvider>
  );
}

