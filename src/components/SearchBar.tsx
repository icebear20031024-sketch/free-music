import React, { useState, useEffect, useRef } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearch: (e?: React.FormEvent) => void;
}

export function SearchBar({ searchQuery, setSearchQuery, onSearch }: SearchBarProps) {
  const [isFocused, setIsFocused] = useState(false);
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
          className="w-full bg-[#F5F5F7] border border-transparent focus:bg-white text-[#1D1D1F] rounded-[8px] py-[10px] pl-[36px] pr-4 focus:outline-none focus:border-[#0071E3] focus:ring-[3px] focus:ring-[#0071E3]/20 transition-all placeholder:text-[#6E6E73] text-[17px] leading-[25px]"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
        />
        
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
                    onSearch();
                  }, 0);
                }}
              >
                <Search className="w-4 h-4 text-[#6E6E73] mr-3 shrink-0" />
                <span className="truncate">{suggestion}</span>
              </div>
            ))}
          </div>
        )}
      </form>
    </header>
  );
}
