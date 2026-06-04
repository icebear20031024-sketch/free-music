import { pluginManager } from './server/plugin-manager.js';

async function testAll() {
  console.log('--- Initializing plugin manager ---');
  await pluginManager.initialize();
  
  const plugins = pluginManager.getAllPlugins();
  console.log(`Found ${plugins.length} plugins`);
  
  for (const [id, plugin] of plugins) {
    if (!plugin.search) {
      console.log(`Plugin [${id}] has no search function`);
      continue;
    }
    console.log(`\nTesting plugin [${id}] - ${plugin.platform || id}:`);
    try {
      const res = await plugin.search('周杰伦', 1, 'music');
      console.log(`[${id}] search status: success`);
      console.log(`[${id}] results count:`, res?.data?.length || 0);
      if (res?.data && res.data.length > 0) {
        const first = res.data[0];
        console.log(`[${id}] First item:`, {
          id: first.id || first.songmid || first.hash,
          title: first.title || first.name,
          artist: first.artist || first.singer,
          artwork: first.artwork || first.pic || first.coverImg || first.picUrl || first.al?.picUrl || first.album?.picUrl
        });
      }
    } catch (err: any) {
      console.error(`[${id}] search error:`, err.message);
      if (err.response) {
        console.error(`[${id}] response status:`, err.response.status, err.response.data);
      }
    }
  }
}

testAll().catch(console.error);
