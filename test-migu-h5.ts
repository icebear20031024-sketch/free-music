import axios from 'axios';

const endpoints = [
  {
    name: 'h5/search/all',
    url: 'https://m.music.migu.cn/migumusic/h5/search/all',
    params: { text: '周杰伦', pageNo: 1, pageSize: 20 }
  },
  {
    name: 'v3/api/search/searchByKeyword',
    url: 'https://m.music.migu.cn/v3/api/search/searchByKeyword',
    params: { keyword: '周杰伦', type: 2, pageNo: 1, pageSize: 20 }
  },
  {
    name: 'search/searchAll',
    url: 'https://m.music.migu.cn/migumusic/h5/search/searchAll',
    params: { text: '周杰伦', pageNo: 1, pageSize: 20 }
  },
  {
    name: 'music_search/v2/search/searchByKeyword',
    url: 'https://m.music.migu.cn/music_search/v2/search/searchByKeyword',
    params: { keyword: '周杰伦', type: 2, pageNo: 1, pageSize: 20 }
  },
  {
    name: 'miguPlay/search/getSearchList',
    url: 'http://music.migu.cn/v3/api/search/getSearchList',
    params: { keyword: '周杰伦', type: 2, pageNo: 1, pageSize: 20 }
  },
  {
    name: 'c.migu.cn H5',
    url: 'https://c.migu.cn/migumusic/h5/search/all',
    params: { text: '周杰伦', pageNo: 1, pageSize: 20 }
  }
];

async function run() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Mobile/15E148 Safari/604.1",
    Referer: 'https://m.music.migu.cn/',
  };
  for (const ep of endpoints) {
    try {
      const res = await axios.get(ep.url, { headers, params: ep.params });
      console.log(`[${ep.name}] SUCCEEDED! Status:`, res.status);
      console.log(`[${ep.name}] Preview:`, JSON.stringify(res.data).substring(0, 400));
    } catch (err: any) {
      console.log(`[${ep.name}] FAILED:`, err.message);
    }
  }
}

run();
