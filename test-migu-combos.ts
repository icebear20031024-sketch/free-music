import axios from 'axios';

async function testCombination(name: string, searchSwitch: string) {
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
    console.log(`[${name}] Keys:`, Object.keys(res.data));
  } catch (err: any) {
    console.error(`[${name}] Failed:`, err.message);
  }
}

async function run() {
  await testCombination('playlist', '{"playlist":1}');
  await testCombination('singer', '{"singer":1}');
  await testCombination('album', '{"album":1}');
  await testCombination('lyric', '{"lyric":1}');
  await testCombination('all', '{"song":1,"album":1,"singer":1,"playlist":1}');
}

run();
