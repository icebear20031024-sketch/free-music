import fetch from 'node-fetch';

async function main() {
  const url = 'https://fastly.jsdelivr.net/gh/Huibq/keep-alive@master/Music_Free/xiaomi.js';
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('Huibq Migu/Xiaomi plugin length:', text.length);
    if (text.length > 500) {
      console.log('First 1000 characters of the file:');
      console.log(text.substring(0, 1000));
      
      const idxGetMediaSource = text.indexOf('async function getMediaSource');
      if (idxGetMediaSource !== -1) {
        console.log('--- getMediaSource function: ---');
        console.log(text.substring(idxGetMediaSource, idxGetMediaSource + 1500));
      } else {
        const idxSearchKey = text.indexOf('search');
        if (idxSearchKey !== -1) {
          console.log('--- Found search keyword: ---');
          console.log(text.substring(idxSearchKey - 100, idxSearchKey + 1500));
        }
      }
    } else {
      console.log('Response content:', text);
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main();
