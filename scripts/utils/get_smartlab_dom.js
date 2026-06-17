const { chromium } = require('playwright');
const fs = require('fs');
async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log("Going to login...");
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.waitForLoadState('networkidle');
  
  console.log("Filling login...");
  await page.fill('input[type="text"], input[name="username"], input[name="email"]', 'pisano.ishtar@gmail.com');
  await page.fill('input[type="password"]', 'atelier');
  await Promise.all([
    page.waitForNavigation({ timeout: 15000 }).catch(e => console.log("Navigation timeout, proceeding anyway")),
    page.click('button[type="submit"]')
  ]);
  
  console.log("Going to new order page...");
  await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(4000); // give it time to render React components
  
  console.log("Extracting DOM...");
  
  // Click Monofocal to expand fields
  try {
     const mono = await page.$('text="Monofocal"');
     if (mono) {
         await mono.click();
         await page.waitForTimeout(2000);
     }
  } catch(e) {}

  const formElements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, select, textarea, button, [role="button"], label, div[role="listbox"]')).map(el => {
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
        tag: el.tagName,
        id: el.id,
        name: el.name,
        type: el.type,
        role: el.getAttribute('role'),
        text: el.innerText ? el.innerText.trim().replace(/\n/g, ' ') : '',
        placeholder: el.placeholder,
        label: label.trim()
      };
    }).filter(i => i.id || i.name || i.text || i.placeholder || i.role === 'listbox');
  });
  
  fs.writeFileSync('smartlab_dom.json', JSON.stringify(formElements, null, 2));
  console.log("Saved to smartlab_dom.json");
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
