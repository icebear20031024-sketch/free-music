import axios from 'axios';

const endpoints = [
  {
    name: 'v3/api/search/searchByKeyword',
    url: 'https://c.migu.cn/v3/api/search/searchByKeyword',
    params: { keyword: '周杰伦', type: 2, pageNo: 1, pageSize: 20 }
  },
  {
    name: 'v3/api/search/getSearchList',
    url: 'https://c.migu.cn/v3/api/search/getSearchList',
    params: { keyword: '周杰伦', type: 2, pageNo: 1, pageSize: 20 }
  },
  {
    name: 'music_search/v2/search/searchByKeyword',
    url: 'https://c.migu.cn/music_search/v2/search/searchByKeyword',
    params: { keyword: '周杰伦', type: 2, pageNo: 1, pageSize: 20 }
  },
  {
    name: 'migu/remoting/scr_search_tag',
    url: 'https://c.migu.cn/migu/remoting/scr_search_tag',
    params: { keyword: '周杰伦', type: 2, pageNo: 1, pageSize: 20 }
  },
  {
    name: 'migumusic/h5/search/all POST',
    url: 'https://c.migu.cn/migumusic/h5/search/all',
    method: 'POST',
    data: { text: '周杰伦', pageNo: 1, pageSize: 20 }
  }
];

async function run() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Mobile/15E148 Safari/604.1",
    Referer: 'https://m.music.migu.cn/',
  };
  for (const ep of endpoints) {
    try {
      let res;
      if (ep.method === 'POST') {
        res = await axios.post(ep.url, ep.data, { headers });
      } else {
        res = await axios.get(ep.url, { headers, params: ep.params });
      }
      console.log(`[${ep.name}] Status:`, res.status);
      console.log(`[${ep.name}] Response:`, JSON.stringify(res.data).substring(0, 500));
    } catch (err: any) {
      console.log(`[${ep.name}] Failed:`, err.message);
    }
  }
}

run();
