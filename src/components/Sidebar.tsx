import { useState } from 'react';
import { Music, Home, Search, Library, Heart, ListMusic, Download, Plus, Trash2, Import, Loader2 } from 'lucide-react';
import { Settings } from 'lucide-react';
import { api } from '../services/api';

import { Playlist, Song } from '../types';

export function Sidebar({ currentView, setView, playlists, createPlaylist, removePlaylist }: { currentView: string; setView: (v: string) => void; playlists: Playlist[]; createPlaylist: (n: string) => void; removePlaylist: (id: string) => void; }) {
  const [newPlName, setNewPlName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [audioQuality, setAudioQuality] = useState(localStorage.getItem('music_audio_quality') || 'standard');

  const handleQualityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setAudioQuality(val);
    localStorage.setItem('music_audio_quality', val);
  };

  const getLinkClasses = (viewName: string) => {
    return `flex items-center gap-3 transition-colors cursor-pointer group px-2 py-1.5 rounded-md min-h-[44px] ${currentView === viewName ? 'text-[#0071E3] font-[600] bg-[#0071E3]/10' : 'text-[#333336] hover:text-[#0071E3] font-[400]'}`;
  };

  const getIconClasses = (viewName: string) => {
    return `w-5 h-5 ${currentView === viewName ? 'text-[#0071E3]' : ''}`;
  };

  const handleCreateNew = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlName.trim()) {
      createPlaylist(newPlName.trim());
      setNewPlName('');
      setIsCreating(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlName.trim()) {
      setIsImporting(false);
      return;
    }
    
    setImportLoading(true);
    try {
       // try plugins to import
       let items: unknown[] = [];
       const sources = ['xiaoyun', 'xiaoqiu', 'xiaogou', 'xiaowo', 'xiaomi'];
       let successSourceId = null;
       for (const sid of sources) {
          try {
             const res = await api.invokePluginMethod(sid, 'importMusicSheet', [newPlName.trim()]) as unknown[];
             if (res && res.length > 0) {
                 successSourceId = sid;
                 items = res;
                 break;
             }
          } catch(e) {}
       }
       if (items.length > 0 && successSourceId) {
          // Format
          const mapped = items.map((item: unknown) => {
                 const m = item as Record<string, unknown>;
                 return {
                 id: String(m.id || m.songmid || m.hash || Math.random()),
                 title: String(m.title || m.name || 'Unknown'),
                 artist: String(m.artist || m.singer || 'Unknown'),
                 album: String(m.album || 'Unknown'),
                 cover: String(m.artwork || m.pic || m.coverImg || m.avatar || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80'),
                 duration: Number(m.duration || m.interval || m.time || m.dt || 0),
                 source: successSourceId as string,
                 sourceId: successSourceId as string,
                 raw: m
                 };
          });
          createPlaylist(`导入歌单 ${items.length}首`, mapped);
       } else {
          alert('未能解析该链接，暂不支持或链接无效');
       }
    } catch(err) {
       console.error(err);
       alert('导入失败');
    } finally {
       setImportLoading(false);
       setNewPlName('');
       setIsImporting(false);
    }
  };

  return (
    <aside className="w-64 bg-[#F5F5F7] border-r border-[#EDEDF2] flex flex-col p-6 hidden md:flex z-20 shrink-0 h-full overflow-y-auto">
      <div className="flex items-center gap-2 mb-10 text-[#0071E3] cursor-pointer" onClick={() => setView('search')}>
        <Music className="w-8 h-8" />
        <h1 className="text-[24px] font-[600] tracking-tight text-[#1D1D1F]">Music</h1>
      </div>
      
      <nav className="flex-1 space-y-6">
        <div className="space-y-3">
          <p className="text-[12px] font-[600] text-[#6E6E73] uppercase tracking-wider">推荐</p>
          <div onClick={() => setView('search')} className={getLinkClasses('search')}>
            <Search className={getIconClasses('search')} /> 发现音乐
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[12px] font-[600] text-[#6E6E73] uppercase tracking-wider">我的音乐</p>
          <div onClick={() => setView('playlist_default')} className={getLinkClasses('playlist_default')}>
            <Heart className={getIconClasses('playlist_default')} /> 我喜欢的音乐
          </div>
          <div onClick={() => setView('downloads')} className={getLinkClasses('downloads')}>
            <Download className={getIconClasses('downloads')} /> 本地下载
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-[#6E6E73]">
            <p className="text-[12px] font-[600] uppercase tracking-wider">创建的歌单</p>
            <div className="flex items-center gap-1">
              <button onClick={() => { setIsImporting(true); setIsCreating(false); setNewPlName(''); }} className="hover:text-[#0071E3] transition-colors p-1" title="导入歌单链接">
                <Import className="w-4 h-4" />
              </button>
              <button onClick={() => { setIsCreating(true); setIsImporting(false); setNewPlName(''); }} className="hover:text-[#0071E3] transition-colors p-1" title="新建歌单">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {isCreating && (
            <form onSubmit={handleCreateNew} className="flex gap-2">
              <input 
                 autoFocus
                 type="text" 
                 value={newPlName} 
                 onChange={e => setNewPlName(e.target.value)} 
                 onBlur={() => { if(!newPlName) setIsCreating(false) }}
                 placeholder="新歌单名称"
                 className="flex-1 min-w-0 bg-white border border-[#D5D5D7] rounded-[8px] px-3 py-2 text-[17px] text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/10 h-[44px]"
              />
            </form>
          )}

          {isImporting && (
            <form onSubmit={handleImport} className="flex gap-2 relative">
              <input 
                 autoFocus
                 type="text" 
                 value={newPlName} 
                 onChange={e => setNewPlName(e.target.value)} 
                 onBlur={() => { if(!newPlName && !importLoading) setIsImporting(false) }}
                 placeholder="输入歌单链接 (如网易云)"
                 disabled={importLoading}
                 className="flex-1 min-w-0 bg-white border border-[#D5D5D7] rounded-[8px] px-3 py-2 pl-3 pr-8 text-[17px] text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/10 h-[44px] disabled:opacity-50"
              />
              {importLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                   <Loader2 className="w-5 h-5 animate-spin text-[#0071E3]" />
                </div>
              )}
            </form>
          )}

          {playlists.filter((p) => p.id !== 'default').map((p) => (
             <div key={p.id} className={`${getLinkClasses('playlist_' + p.id)} justify-between`}>
               <div className="flex items-center gap-3 overflow-hidden flex-1" onClick={() => setView('playlist_' + p.id)}>
                 <ListMusic className={getIconClasses('playlist_' + p.id)} /> 
                 <span className="truncate">{p.name}</span>
               </div>
               <button onClick={(e) => { e.stopPropagation(); removePlaylist(p.id); }} className="opacity-0 group-hover:opacity-100 text-[#6E6E73] hover:text-[#e30000] transition-all p-2 h-[44px] flex items-center">
                  <Trash2 className="w-4 h-4" />
               </button>
             </div>
          ))}
        </div>
      </nav>

      <div className="mt-auto pt-6 border-t border-[#EDEDF2] flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[#6E6E73] px-1">
          <Settings className="w-4 h-4" />
          <span className="text-[13px] font-[600] uppercase tracking-wider">音质选择</span>
        </div>
        <select 
          value={audioQuality} 
          onChange={handleQualityChange}
          className="w-full bg-white border border-[#D5D5D7] rounded-[8px] px-3 py-2 text-[14px] text-[#1D1D1F] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/10 cursor-pointer appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMzMzMzMzYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTUgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=')] bg-no-repeat bg-[position:right_12px_center] bg-[length:16px_16px] pr-8"
        >
          <option value="low">标准 (128kbps)</option>
          <option value="standard">较高 (320kbps)</option>
          <option value="flac">无损 (FLAC)</option>
          <option value="wav">原音轨 (WAV)</option>
        </select>
      </div>
    </aside>
  );
}
