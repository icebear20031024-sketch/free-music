import fetch from 'node-fetch';

async function main() {
  const url = 'https://gitee.com/ThomasYou/musicfree/raw/master/dist/mg/index.js';
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('ThomasYou Migu plugin length:', text.length);
    const idxGetMediaSource = text.indexOf('getMediaSource');
    if (idxGetMediaSource !== -1) {
      console.log('--- ThomasYou getMediaSource: ---');
      console.log(text.substring(idxGetMediaSource, idxGetMediaSource + 1500));
    } else {
      console.log('First 500 chars:', text.substring(0, 500));
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main();
