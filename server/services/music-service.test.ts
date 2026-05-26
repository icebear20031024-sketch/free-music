import { describe, it, expect, vi } from 'vitest';
import { MusicService } from './music-service.js';
import { pluginManager } from '../plugin-manager.js';

vi.mock('../plugin-manager.js', () => ({
  pluginManager: {
    getAllPlugins: vi.fn(),
    getPlugin: vi.fn(),
  }
}));

describe('MusicService', () => {
  it('should search across all plugins', async () => {
    vi.mocked(pluginManager.getAllPlugins).mockReturnValue([
      ['test', { 
         platform: 'test', 
         search: vi.fn().mockResolvedValue({ data: [{ id: '1' }] }) 
      } as any]
    ]);

    const service = new MusicService();
    const results = await service.searchMusic('hello', 1);
    
    expect(results).toHaveLength(1);
    expect(results[0].sourceId).toBe('test');
    expect(results[0].data).toEqual([{ id: '1' }]);
  });
});
