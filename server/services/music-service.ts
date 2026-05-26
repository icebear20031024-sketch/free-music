import { pluginManager } from '../plugin-manager.js';
import { logger } from '../utils/logger.js';

export const withTimeout = <T>(promise: Promise<T>, ms: number, fallbackMsg: string): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(fallbackMsg)), ms);
    promise
      .then(res => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

export class MusicService {
  async searchMusic(query: string, page: number = 1) {
    return Promise.all(
      pluginManager.getAllPlugins().map(async ([id, plugin]) => {
        try {
          if (!plugin.search) return { sourceId: id, error: 'No search function' };
          const res = await withTimeout<unknown>(
            plugin.search(query, page, 'music'),
            8000,
            'Search timeout'
          );
          const dataResult = res as { data?: unknown[]; isEnd?: boolean };
          return {
            sourceId: id,
            platform: plugin.platform || id,
            data: dataResult.data || dataResult.isEnd || res || []
          };
        } catch (e) {
          logger.warn(`Search failed on plugin ${id}:`, e);
          return { sourceId: id, error: e instanceof Error ? e.message : String(e) };
        }
      })
    );
  }
}

export const musicService = new MusicService();
