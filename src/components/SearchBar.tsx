import React, { useState, useEffect, useRef } from 'react';
import { Search, Check, SlidersHorizontal } from 'lucide-react';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearch: (e?: React.FormEvent, overrideQuery?: string) => void;
  selectedSources?: string[];
  onToggleSource?: (id: string) => void;
}

const ALL_PLATFORMS = [
  { id: 'xiaoqiu', name: '小秋音乐' },
  { id: 'xiaowo', name: '小蜗音乐' },
  { id: 'xiaoyun', name: '小芸音乐' },
  { id: 'xiaogou', name: '小枸音乐' },
  { id: 'xiaomi', name: '小蜜音乐' }
];

export function SearchBar({ 
  searchQuery, 
  setSearchQuery, 
  onSearch,
  selectedSources = ['xiaoqiu', 'xiaowo', 'xiaoyun', 'xiaogou', 'xiaomi'],
  onToggleSource
}: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('search_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (searchQuery.trim()) {
      const newHistory = [searchQuery.trim(), ...history.filter(h => h !== searchQuery.trim())].slice(0, 10);
      setHistory(newHistory);
      localStorage.setItem('search_history', JSON.stringify(newHistory));
    }
    setIsFocused(false);
    setShowFilterDropdown(false);
    onSearch(e);
  };

  const suggestions = history.filter(h => 
    searchQuery.trim() === '' || h.toLowerCase().startsWith(searchQuery.toLowerCase().trim())
  );

  return (
    <header className="h-[44px] flex items-center bg-transparent shrink-0 flex-1 mr-4" ref={containerRef}>
      <form onSubmit={handleSearch} className="w-full max-w-md relative">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6E73] pointer-events-none" />
        <input
          type="text"
          placeholder="搜索音乐、歌手、歌词..."
          className="w-full bg-[#F5F5F7] border border-transparent focus:bg-white text-[#1D1D1F] rounded-[8px] py-[10px] pl-[36px] pr-[44px] focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/20 transition-all placeholder:text-[#6E6E73] text-[17px] leading-[25px]"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            setShowFilterDropdown(false);
          }}
        />

        <button
          type="button"
          onClick={() => {
            setShowFilterDropdown(!showFilterDropdown);
            setIsFocused(false);
          }}
          className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-black/5 transition-colors ${selectedSources.length < 5 ? 'text-[#0071E3]' : 'text-[#6E6E73]'}`}
          title="选择搜索平台"
        >
          <SlidersHorizontal className="w-5 h-5 animate-pulse-once" />
          {selectedSources.length < 5 && (
            <span className="absolute top-[3px] right-[3px] w-1.5 h-1.5 bg-[#0071E3] rounded-full" />
          )}
        </button>
        
        {isFocused && suggestions.length > 0 && (
          <div className="absolute top-full mt-2 w-full bg-white/95 backdrop-blur-xl border border-[#EDEDF2] rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] overflow-hidden z-50">
            {suggestions.map((suggestion, index) => (
              <div 
                key={index}
                className="px-4 py-3 text-[15px] cursor-pointer hover:bg-[#F5F5F7] text-[#1D1D1F] transition-colors flex items-center"
                onMouseDown={(e) => {
                  // Use mousedown to prevent input blur before click fires
                  e.preventDefault();
                  setSearchQuery(suggestion);
                  
                  // Wrap in timeout to let state update before searching
                  setTimeout(() => {
                    const newHistory = [suggestion, ...history.filter(h => h !== suggestion)].slice(0, 10);
                    setHistory(newHistory);
                    localStorage.setItem('search_history', JSON.stringify(newHistory));
                    setIsFocused(false);
                    onSearch(undefined, suggestion);
                  }, 0);
                }}
              >
                <Search className="w-4 h-4 text-[#6E6E73] mr-3 shrink-0" />
                <span className="truncate">{suggestion}</span>
              </div>
            ))}
          </div>
        )}

        {showFilterDropdown && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white/95 backdrop-blur-xl border border-[#EDEDF2] rounded-[12px] shadow-[0_8px_32px_rgba(0,0,0,0.12)] p-4 z-50">
            <div className="text-[13px] font-[600] text-[#6E6E73] border-b border-[#EDEDF2] pb-2 mb-2 uppercase tracking-wide">搜索音源平台</div>
            <div className="space-y-1">
              {ALL_PLATFORMS.map(platform => {
                const isChecked = selectedSources.includes(platform.id);
                return (
                  <div 
                    key={platform.id} 
                    onClick={() => onToggleSource && onToggleSource(platform.id)}
                    className="flex items-center gap-3 py-2 px-2 hover:bg-[#F5F5F7] rounded-lg cursor-pointer transition-colors select-none"
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isChecked ? 'bg-[#0071E3] border-[#0071E3]' : 'border-[#CCCCCC]'}`}>
                      {isChecked && <Check className="w-3 h-3 text-white stroke-[3px]" />}
                    </div>
                    <span className="text-[15px] font-[400] text-[#1D1D1F]">{platform.name}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-[11px] text-[#8E8E93] mt-3 pt-2 border-t border-[#EDEDF2] leading-normal font-[400]">
              建议勾选多源平台。若某些音源无版权无法播放，切换或开启多源重新搜索即可。
            </div>
          </div>
        )}
      </form>
    </header>
  );
}
