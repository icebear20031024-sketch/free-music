import fetch from 'node-fetch';

async function main() {
  const url = 'https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaomi.js';
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('Upstream xiaomi.js length:', text.length);
    // Find searchBase or searchMusic in the code and print around it
    const index = text.indexOf('searchMusic');
    if (index !== -1) {
      console.log('Found searchMusic in upstream code. Content:');
      console.log(text.substring(index - 500, index + 1000));
    } else {
      console.log('Could not find searchMusic in upstream code. First 500 chars:');
      console.log(text.substring(0, 500));
    }
  } catch (err: any) {
    console.error('Error fetching upstream xiaomi:', err.message);
  }
}

main();
