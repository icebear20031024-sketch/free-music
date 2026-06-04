import fetch from 'node-fetch';

async function main() {
  const url = 'https://fastly.jsdelivr.net/gh/meerl/MusicFreePlugins@main/plugins.json';
  try {
    const res = await fetch(url);
    const json: any = await res.json();
    console.log('Successfully loaded plugins.json from meerl/MusicFreePlugins');
    const plugins = json.plugins || [];
    console.log('Total plugins listed:', plugins.length);
    
    // Find all plugins with name containing "migu" or "蜜" or "咪" or id "xiaomi"
    const miguPlugins = plugins.filter((p: any) => 
      p.name?.includes('蜜') || p.name?.includes('咪') || p.name?.includes('migu') || p.id?.includes('xiaomi')
    );
    console.log('Migu/Xiaomi-related plugins found:', miguPlugins.length);
    for (const p of miguPlugins) {
      console.log(`- Name: ${p.name}, ID: ${p.src}, Author: ${p.author}, URL: ${p.srcUrl || p.url}`);
    }
  } catch (err: any) {
    console.error('Error fetching plugins.json:', err.message);
  }
}

main();
