import axios from 'axios';

async function testType(name: string, searchSwitch: string) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Mobile/15E148 Safari/604.1",
    Referer: 'https://m.music.migu.cn/',
  };
  try {
    const res = await axios.get("https://c.migu.cn/MIGUM2.0/v1.0/content/search_all.do", {
      headers,
      params: {
        text: '周杰伦',
        pageNo: 1,
        pageSize: 5,
        isCorrect: 1,
        isCopyright: 1,
        searchSwitch,
      },
    });
    console.log(`[${name}] Status:`, res.status);
    console.log(`[${name}] Keys:`, Object.keys(res.data));
    // Find keys ending with "ResultData"
    const dataKeys = Object.keys(res.data).filter(k => k.endsWith('ResultData'));
    console.log(`[${name}] ResultData Keys:`, dataKeys);
    for (const key of dataKeys) {
      const rd = res.data[key];
      const results = rd?.result || [];
      console.log(`[${name}] ${key} total:`, rd?.totalCount, 'Items count:', results.length);
      if (results.length > 0) {
        console.log(`[${name}] First Item:`, JSON.stringify(results[0]).substring(0, 1000));
      }
    }
  } catch (err: any) {
    console.error(`[${name}] Failed:`, err.message);
  }
}

async function run() {
  await testType('Music', '{"song":1}');
  await testType('Album', '{"album":1}');
  await testType('Artist', '{"singer":1}');
  await testType('MusicSheet', '{"list":1}');
  await testType('Lyric', '{"lyric":1}');
}

run();
