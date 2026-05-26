import { describe, it, expect, vi } from 'vitest';
import { MusicService } from './music-service.js';
import { pluginManager } from '../plugin-manager.js';
import { InternalPluginInterface } from '../../src/types.js';

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
      } as unknown as InternalPluginInterface]
    ]);

    const service = new MusicService();
    const results = await service.searchMusic('hello', 1);
    
    expect(results).toHaveLength(1);
    expect(results[0].sourceId).toBe('test');
    expect((results[0] as unknown as { data: unknown[] }).data).toEqual([{ id: '1' }]);
  });

  it('should only search across specified plugins if sources parameter is provided', async () => {
    vi.mocked(pluginManager.getAllPlugins).mockReturnValue([
      ['test1', { 
         platform: 'test1', 
         search: vi.fn().mockResolvedValue({ data: [{ id: '1' }] }) 
      } as unknown as InternalPluginInterface],
      ['test2', { 
         platform: 'test2', 
         search: vi.fn().mockResolvedValue({ data: [{ id: '2' }] }) 
      } as unknown as InternalPluginInterface]
    ]);

    const service = new MusicService();
    // Test filtering out test2
    const results = await service.searchMusic('hello', 1, ['test1']);
    
    expect(results).toHaveLength(1);
    expect(results[0].sourceId).toBe('test1');
  });
});
