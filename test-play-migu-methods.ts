import axios from 'axios';

async function testRenderApi(id: string) {
  try {
    const res = await axios.get(`https://lxmusicapi.onrender.com/url/mg/${id}/320k`, {
      headers: { "X-Request-Key": "share-v3" },
    });
    console.log('[lxmusicapi] id:', id, 'response:', res.data);
  } catch (err: any) {
    console.error('[lxmusicapi] error:', err.message);
  }
}

async function testNativeCmsDetail(copyrightId: string) {
  const headers = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
    Connection: "keep-alive",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Host: "m.music.migu.cn",
    Referer: `https://m.music.migu.cn/migu/l/?s=149&p=163&c=5200&j=l&id=${copyrightId}`,
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent": "Mozilla/5.0 (Linux; Android 6.0.1; Moto G (4)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Mobile Safari/537.36 Edg/89.0.774.68",
    "X-Requested-With": "XMLHttpRequest",
  };
  try {
    const res = await axios.get("https://m.music.migu.cn/migu/remoting/cms_detail_tag", {
      headers,
      params: { cpid: copyrightId },
    });
    console.log('[Native CMS Detail] copyrightId:', copyrightId, 'response:', typeof res.data === 'object' ? JSON.stringify(res.data).substring(0, 500) : res.data);
  } catch (err: any) {
    console.error('[Native CMS Detail] error:', err.message);
  }
}

async function main() {
  // Let's test a very popular, old Jay Chou song to make sure it plays: e.g. "晴天" (id might be different, let's search via c.migu.cn first!)
  const searchRes = await axios.get("https://c.migu.cn/MIGUM2.0/v1.0/content/search_all.do", {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 14_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.2 Mobile/15E148 Safari/604.1",
      Referer: 'https://m.music.migu.cn/',
    },
    params: {
      text: '晴天 周杰伦',
      pageNo: 1,
      pageSize: 3,
      isCorrect: 1,
      isCopyright: 1,
      searchSwitch: '{"song":1}',
    },
  });

  const songs = searchRes.data?.songResultData?.result || [];
  console.log('Search songs count:', songs.length);
  if (songs.length > 0) {
    const firstSong = songs[0];
    console.log('First search song:', firstSong.name, 'id:', firstSong.id, 'copyrightId:', firstSong.copyrightId);
    await testRenderApi(firstSong.id);
    await testRenderApi(firstSong.copyrightId);
    await testNativeCmsDetail(firstSong.copyrightId);
  }
}

main();
