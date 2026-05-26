import { api } from './src/services/api.js';
import { pluginManager } from './plugin-manager.js';

(async () => {
    await pluginManager.initialize();
    const plugins = pluginManager.getAllPlugins();
    for (const [id, plugin] of plugins) {
        if (!plugin.search) continue;
        try {
            const res = await plugin.search('周杰伦', 1, 'music');
            if (res && res.data && res.data[0] && plugin.getLyric) {
                const lrc = await plugin.getLyric(res.data[0]);
                if (lrc && lrc.rawLrc) {
                    const parsed = (api as any).parseLyric(lrc.rawLrc);
                    console.log(id, 'parsed lines length:', parsed.length);
                    console.log(id, 'first 3 lines:', parsed.slice(0, 3));
                }
            }
        } catch(e) {}
    }
})();
