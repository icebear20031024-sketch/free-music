import axios from 'axios';

async function main() {
  const headers = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    Connection: "keep-alive",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Host: "m.music.migu.cn",
    Referer: `https://m.music.migu.cn/v3/search?keyword=${encodeURIComponent('周杰伦')}`,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": "Mozilla/5.0 (Linux; Android 6.0.1; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Mobile Safari/537.36 Edg/89.0.774.68",
    "X-Requested-With": "XMLHttpRequest",
  };
  const params = {
    keyword: '周杰伦',
    type: 2,
    pgc: 1,
    rows: 20,
  };
  try {
    const res = await axios.get("https://m.music.migu.cn/migu/remoting/scr_search_tag", { headers, params });
    console.log('Migu status:', res.status);
    console.log('Migu response:', JSON.stringify(res.data).substring(0, 1000));
  } catch (err: any) {
    console.error('Migu error:', err.message);
  }
}

main();
