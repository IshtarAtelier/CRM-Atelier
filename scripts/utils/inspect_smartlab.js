const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.fill('input[type="text"], input[name="username"], input[name="email"]', 'atelier');
  await page.fill('input[type="password"]', 'Atelier2024');
  await page.click('button[type="submit"]');
  await page.waitForNavigation();
  await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new');
  await page.waitForTimeout(2000);
  
  // Dump inputs
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, select, textarea')).map(el => {
      let label = '';
      if (el.id) {
        const l = document.querySelector(`label[for="${el.id}"]`);
        if (l) label = l.innerText;
      }
      if (!label && el.closest('div')) {
         const p = el.closest('div').previousElementSibling;
         if (p && p.tagName === 'LABEL') label = p.innerText;
      }
      return {
        id: el.id,
        name: el.name,
        type: el.type,
        role: el.getAttribute('role'),
        placeholder: el.placeholder,
        label: label.trim()
      };
    });
  });
  console.log(JSON.stringify(inputs.filter(i => i.id || i.name), null, 2));
  await browser.close();
}
main().catch(console.error);
