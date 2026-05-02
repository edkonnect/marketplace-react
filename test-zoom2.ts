import * as dotenv from 'dotenv';
dotenv.config();
import { getZoomAccessToken } from './server/zoom-service';

async function main() {
  const token = await getZoomAccessToken();
  const res = await fetch('https://api.zoom.us/v2/meetings/8284931787', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status:', res.status, res.statusText);
  const body = await res.json();
  console.log('Body:', JSON.stringify(body, null, 2));
}
main().catch(console.error);
