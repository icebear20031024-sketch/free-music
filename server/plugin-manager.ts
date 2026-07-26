import path from 'path';
import fs from 'fs/promises';
import { logger } from './utils/logger.js';
import { PLUGINS_DIR } from './utils/paths.js';
import { InternalPluginInterface } from '../src/types.js';

// Pre-configured plugins
const PLUGINS_CONFIG = [
  { name: "小秋音乐", url: "https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaoqiu.js", id: "xiaoqiu" },
  { name: "小蜗音乐", url: "https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaowo.js", id: "xiaowo" },
  { name: "小芸音乐", url: "https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaoyun.js", id: "xiaoyun" },
  { name: "小枸音乐", url: "https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaogou.js", id: "xiaogou" },
  { name: "小蜜音乐", url: "https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaomi.js", id: "xiaomi" }
];

class PluginManager {
  private loadedPlugins: Record<string, InternalPluginInterface> = {};

  async initialize() {
    await this.ensurePlugins();
    await this.loadPlugins();
  }

  private async ensurePlugins() {
    await fs.mkdir(PLUGINS_DIR, { recursive: true });
    
    for (const plugin of PLUGINS_CONFIG) {
      const filePath = path.join(PLUGINS_DIR, `${plugin.id}.cjs`);
      try {
        await fs.access(filePath);
      } catch {
        logger.info(`Downloading ${plugin.name} plugin...`);
        try {
          const res = await fetch(plugin.url);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          let code = await res.text();
          if (plugin.id === 'xiaomi') {
             code = code.replace(/data\.musics\.map/g, '(data.musics || []).map')
                        .replace(/data\.albums\.map/g, '(data.albums || []).map')
                        .replace(/data\.artists\.map/g, '(data.artists || []).map')
                        .replace(/data\.songLists\.map/g, '(data.songLists || []).map')
                        .replace(/data\.songs\.map/g, '(data.songs || []).map');
          }
          if (plugin.id === 'xiaowo') {
             code = code.replace(/res\.data\.lrclist/g, '(res.data && res.data.lrclist || [])');
             code = code.replace(/res\.data\.songs/g, '(res.data && res.data.songs || [])');
          }
          // Mock env if they use window or navigator
          const wrapped = `
            const window = { navigator: { userAgent: "Mozilla/5.0" } };
            ${code}
          `;
          await fs.writeFile(filePath, wrapped);
          logger.info(`Successfully downloaded plugin: ${plugin.name}`);
        } catch (error) {
          logger.error(`Failed to download plugin ${plugin.name}:`, error);
        }
      }
    }
  }

  private async loadPlugins() {
    for (const plugin of PLUGINS_CONFIG) {
      const filePath = path.join(PLUGINS_DIR, `${plugin.id}.cjs`);
      try {
        const module = await import(`file://${filePath}`);
        this.loadedPlugins[plugin.id] = module.default || module;
        logger.info(`Loaded plugin: ${plugin.name} (${plugin.id})`);
      } catch (e) {
        logger.error(`Failed to load plugin ${plugin.id}:`, e);
      }
    }
  }

  getPlugin(id: string) {
    return this.loadedPlugins[id];
  }

  getAllPlugins() {
    return Object.entries(this.loadedPlugins);
  }

  getPluginIds() {
    return Object.keys(this.loadedPlugins);
  }
}

export const pluginManager = new PluginManager();
