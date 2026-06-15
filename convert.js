const sharp = require('sharp');
async function run() {
  await sharp('/Users/ishtarpissano/.gemini/antigravity/brain/f5ea4119-2952-45b3-8750-2e14f1016b3e/venus_calypso_glasses_1781538532181.png')
    .webp({ quality: 85 })
    .toFile('/Users/ishtarpissano/proyectos/atelier/public/images/editorial/filmmaker-venus.webp');
  console.log("Done WebP");
}
run();
