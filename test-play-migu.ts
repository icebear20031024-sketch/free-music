import axios from 'axios';

async function main() {
  // Let's test the song "太阳之子" with id "1142543109"
  try {
    const res = await axios.get("https://lxmusicapi.onrender.com/url/mg/1142543109/320k", {
      headers: {
        "X-Request-Key": "share-v3",
      },
    });
    console.log('Playback url status:', res.status);
    console.log('Playback url response:', res.data);
  } catch (err: any) {
    console.error('Playback failed:', err.message);
  }
}

main();
