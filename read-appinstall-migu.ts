import fetch from 'node-fetch';

async function main() {
  const url = 'http://adad23u.appinstall.life/dist/migu/index.js';
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('Appinstall.life migu index.js length:', text.length);
    const index = text.indexOf('search');
    if (index !== -1) {
      console.log('Search block surrounding (1500 chars):');
      console.log(text.substring(index - 200, index + 1500));
    } else {
      console.log('Could not find search. First 500 chars:');
      console.log(text.substring(0, 500));
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

main();
