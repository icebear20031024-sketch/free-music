import axios from 'axios';

async function testKugou() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
    Accept: "*/*",
  };
  try {
    const res = (await axios.get("https://songsearch.kugou.com/song_search_v2", {
      headers,
      params: {
        keyword: '周杰伦',
        page: 1,
        pagesize: 30,
        userid: 0,
        clientver: "",
        platform: "WebFilter",
        filter: 2,
        iscorrection: 1,
        privilege_filter: 0,
        area_code: 1,
      },
    })).data;
    console.log('Kugou direct song_search_v2 response:', JSON.stringify(res).substring(0, 500));
  } catch (err: any) {
    console.error('Kugou error:', err.message);
  }
}

testKugou();
