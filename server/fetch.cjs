const https = require('https');
https.get('https://fastly.jsdelivr.net/gh/Huibq/keep-alive/Music_Free/xiaoqiu.js', (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => console.log(body.substring(0, 1000)));
});
