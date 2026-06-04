import axios from 'axios';

async function main() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
    Referer: 'https://music.migu.cn/v3/search',
  };
  try {
    const res = await axios.get("https://music.migu.cn/v3/api/search/getSearchList", {
      headers,
      params: {
        keyword: '周杰伦',
        type: 2,
        pageNo: 1,
        pageSize: 20
      },
    });
    console.log('music.migu.cn status:', res.status);
    console.log('music.migu.cn body:', JSON.stringify(res.data).substring(0, 1000));
  } catch (err: any) {
    console.error('music.migu.cn failed:', err.message);
  }
}

main();
