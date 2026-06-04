import axios from 'axios';

async function main() {
  const kuwoId = '228260742'; // "演员" Kuwo ID, or any valid ID
  const url = `http://antiserver.kuwo.cn/anti.s?useless=1&format=mp3&rid=MUSIC_${kuwoId}&response=url&type=convert_url3`;
  try {
    const res = await axios.get(url, {
      timeout: 5000,
    });
    console.log('Kuwo anti response status:', res.status);
    console.log('Kuwo anti response body:', res.data);
  } catch (err: any) {
    console.error('Kuwo anti failed:', err.message);
  }
}

main();
