import * as dotenv from 'dotenv';
dotenv.config();
import { getFreshHostUrl } from './server/zoom-service';

async function main() {
  const url = await getFreshHostUrl('8284931787');
  console.log('URL:', url);
}
main().catch(console.error);
