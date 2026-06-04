import fetch from 'node-fetch';

async function main() {
  const url = 'https://raw.niuma666bet.buzz/Huibq/keep-alive/master/Music_Free/xiaomi.js';
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log('Huibq Migu/Xiaomi plugin length:', text.length);
    if (text.length > 500) {
      console.log('First 1000 characters:');
      console.log(text.substring(0, 1000));
      
      const idxSearch = text.indexOf('search(');
      if (idxSearch !== -1) {
        console.log('--- Search function: ---');
        console.log(text.substring(idxSearch, idxSearch + 2000));
      } else {
        const idxSearchKey = text.indexOf('search');
        if (idxSearchKey !== -1) {
          console.log('--- Found search keyword: ---');
          console.log(text.substring(idxSearchKey - 50, idxSearchKey + 2000));
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
