import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders correctly', () => {
    const setSearchQuery = vi.fn();
    const onSearch = vi.fn();
    
    render(<SearchBar searchQuery="" setSearchQuery={setSearchQuery} onSearch={onSearch} />);
    expect(screen.getByPlaceholderText('搜索音乐、歌手、歌词...')).toBeInTheDocument();
  });

  it('shows autocomplete dropdown on focus and typing with history', () => {
    localStorage.setItem('search_history', JSON.stringify(['周杰伦', '陈奕迅', '流行歌曲', '周传雄']));
    
    const setSearchQuery = vi.fn();
    const onSearch = vi.fn();
    
    const { rerender } = render(<SearchBar searchQuery="" setSearchQuery={setSearchQuery} onSearch={onSearch} />);
    
    const input = screen.getByPlaceholderText('搜索音乐、歌手、歌词...');
    fireEvent.focus(input);
    
    // initially shows recent history
    expect(screen.getByText('周杰伦')).toBeInTheDocument();
    
    // type a prefix
    rerender(<SearchBar searchQuery="周" setSearchQuery={setSearchQuery} onSearch={onSearch} />);
    
    // should filter history and show '周杰伦' and '周传雄'
    expect(screen.getByText('周杰伦')).toBeInTheDocument();
    expect(screen.getByText('周传雄')).toBeInTheDocument();
    expect(screen.queryByText('陈奕迅')).not.toBeInTheDocument();
  });

  it('selects suggestion and triggers search', async () => {
    localStorage.setItem('search_history', JSON.stringify(['测试歌曲']));
    
    let currentQuery = '测';
    const setSearchQuery = vi.fn().mockImplementation((val) => { currentQuery = val; });
    const onSearch = vi.fn((e) => e?.preventDefault());
    
    render(<SearchBar searchQuery={currentQuery} setSearchQuery={setSearchQuery} onSearch={onSearch} />);
    
    const input = screen.getByPlaceholderText('搜索音乐、歌手、歌词...');
    fireEvent.focus(input);
    
    const suggestion = screen.getByText('测试歌曲');
    fireEvent.mouseDown(suggestion);
    
    expect(setSearchQuery).toHaveBeenCalledWith('测试歌曲');
    
    await waitFor(() => {
      expect(onSearch).toHaveBeenCalled();
    });
  });
});
