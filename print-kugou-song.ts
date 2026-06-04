import axios from 'axios';

async function main() {
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
        pagesize: 5,
        showtype: 1,
        format: 'json'
      },
    })).data;
    if (res?.data?.info && res.data.info.length > 0) {
      console.log('Structure of info[0]:', JSON.stringify(res.data.info[0], null, 2));
    } else {
      console.log('No results found.');
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main();
