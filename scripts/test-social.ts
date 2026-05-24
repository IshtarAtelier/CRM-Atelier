import { generateSocialContent } from '../src/services/social-content.service';

async function test() {
  try {
    const res = await generateSocialContent({
      platform: 'INSTAGRAM',
      format: 'STORY',
      sourceType: 'FREE',
      topic: 'horarios de direccion de la optica',
      imageStyle: 'PLACA'
    });
    console.log(res);
  } catch (e) {
    console.error(e);
  }
}
test();
