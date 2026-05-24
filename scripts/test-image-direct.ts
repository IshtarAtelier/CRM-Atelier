import { generateSocialImage } from '../src/services/social-content.service';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
  try {
    const res = await generateSocialImage('cmpk9dbbz0000r9va6ou5nrm1');
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}
test();
