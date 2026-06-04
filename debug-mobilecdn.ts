import axios from 'axios';

async function testMobileCDN() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
    Accept: "*/*",
  };
  try {
    const res = (await axios.get("http://mobilecdn.kugou.com/api/v3/search/song", {
      headers,
      params: {
        keyword: '周杰伦',
        page: 1,
        pagesize: 30,
        showtype: 1,
        format: 'json'
      },
    })).data;
    console.log('mobilecdn Kugou search response count:', res?.data?.info?.length || 0);
    if (res?.data?.info) {
      console.log('First search item hash:', res.data.info[0]?.hash, 'filename:', res.data.info[0]?.filename);
    }
  } catch (err: any) {
    console.error('mobilecdn error:', err.message);
  }
}

async function testComplexSearch() {
  const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/106.0.0.0 Safari/537.36",
    Accept: "*/*",
  };
  try {
    const res = (await axios.get("https://complexsearch.kugou.com/v2/search/song", {
      headers,
      params: {
        keyword: '周杰伦',
        page: 1,
        pagesize: 30,
        platform: 'WebFilter',
        iscorrection: 1,
        privilege_filter: 0
      },
    })).data;
    console.log('complexsearch response data:', JSON.stringify(res).substring(0, 300));
  } catch (err: any) {
    console.error('complexsearch error:', err.message);
  }
}

testMobileCDN().then(testComplexSearch);
