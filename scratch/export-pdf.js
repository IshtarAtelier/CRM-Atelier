const playwright = require('playwright');
const path = require('path');

async function main() {
  console.log("Launching headless browser with Playwright...");
  const browser = await playwright.chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const htmlPath = 'file://' + path.resolve('/Users/ishtarpissano/proyectos/atelier/scratch/lista-precios.html');
  console.log(`Opening HTML page: ${htmlPath}`);
  await page.goto(htmlPath, { waitUntil: 'networkidle' });
  
  const pdfPath = '/Users/ishtarpissano/proyectos/atelier/backups/2026-05-22/lista-precios-cristales.pdf';
  console.log(`Exporting PDF to: ${pdfPath}`);
  
  await page.pdf({
    path: pdfPath,
    format: 'A4',
    margin: {
      top: '20mm',
      bottom: '20mm',
      left: '15mm',
      right: '15mm'
    },
    printBackground: true
  });
  
  console.log("PDF generated successfully!");
  await browser.close();
}

main().catch(err => {
  console.error("Playwright PDF generation failed:", err);
  process.exit(1);
});
