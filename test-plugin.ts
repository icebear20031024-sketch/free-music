import { pluginManager } from './plugin-manager.js';

(async () => {
    await pluginManager.initialize();
    const plugins = pluginManager.getAllPlugins();
    for (const [id, plugin] of plugins) {
        if (!plugin.search) continue;
        console.log("Testing search for", id);
        try {
            const res = await plugin.search('周杰伦', 1, 'music');
            if (res && res.data && res.data[0]) {
                if (plugin.getLyric) {
                    const lrc = await plugin.getLyric(res.data[0]);
                    console.log(id, 'lyric keys:', Object.keys(lrc || {}));
                    console.log(id, 'raw lrc start:', (lrc.rawLrc || lrc.lyric || lrc.lrc || '').substring(0, 30));
                }
            } else {
                console.log(id, 'no search results');
            }
        } catch(e) {
            console.error(id, 'error', (e as any).message);
        }
    }
})();
