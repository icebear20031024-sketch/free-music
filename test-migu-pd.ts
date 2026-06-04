import axios from 'axios';

async function testPD() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Mobile/15E148 Safari/604.1",
    Referer: 'https://m.music.migu.cn/',
    "channel": "0146741"
  };
  try {
    const res = await axios.get("http://pd.musicquery.migu.cn/v1/song/search", {
      headers,
      params: {
        keyword: '周杰伦',
        pgc: 1,
        rows: 20,
        type: 2
      },
    });
    console.log('PD search response status:', res.status);
    console.log('PD search response keys:', Object.keys(res.data));
    console.log('PD search response length:', JSON.stringify(res.data).length);
    console.log('PD search response preview:', JSON.stringify(res.data).substring(0, 1000));
  } catch (err: any) {
    console.error('PD search failed:', err.message);
  }
}

async function testJadeite() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Mobile/15E148 Safari/604.1",
    Referer: 'https://m.music.migu.cn/',
  };
  try {
    const res = await axios.get("https://jadeite.migu.cn/music_search/v2/search/searchByKeyword", {
      headers,
      params: {
        keyword: '周杰伦',
        pgc: 1,
        rows: 20,
        type: 2
      },
    });
    console.log('Jadeite search response status:', res.status);
    console.log('Jadeite search response preview:', JSON.stringify(res.data).substring(0, 500));
  } catch (err: any) {
    console.error('Jadeite search failed:', err.message);
  }
}

testPD().then(testJadeite);
