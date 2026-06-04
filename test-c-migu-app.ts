import axios from 'axios';

async function main() {
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
        pageSize: 20,
        isCorrect: 1,
        isCopyright: 1,
        searchSwitch: '{"song":1,"album":0,"list":0,"singer":0,"lyric":0}',
      },
    });
    console.log('c.migu.cn MIGUM2.0 status:', res.status);
    console.log('c.migu.cn MIGUM2.0 preview:', JSON.stringify(res.data).substring(0, 1500));
  } catch (err: any) {
    console.error('c.migu.cn MIGUM2.0 failed:', err.message);
  }
}

main();
