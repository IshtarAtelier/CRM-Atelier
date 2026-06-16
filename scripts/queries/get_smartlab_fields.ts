import { chromium } from 'playwright';
import * as fs from 'fs';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log("Navigating to login page...");
    await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login', { waitUntil: 'domcontentloaded' });
    
    await page.waitForSelector('input', { state: 'attached', timeout: 15000 });

    const userSelectors = ['input[id*="username"]', 'input[type="email"]', 'input[name="user"]'];
    const passSelectors = ['input[id*="password"]', 'input[type="password"]'];
    
    for (const sel of userSelectors) {
      if (await page.$(sel)) {
        await page.fill(sel, 'pisano.ishtar@gmail.com');
        break;
      }
    }
    
    for (const sel of passSelectors) {
      if (await page.$(sel)) {
        await page.fill(sel, 'atelier');
        break;
      }
    }
    
    const submitSelectors = ['button[type="submit"]'];
    for (const sel of submitSelectors) {
        const btn = await page.$(sel);
        if (btn) {
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {}),
                btn.click()
            ]);
            break;
        }
    }

    console.log("Logged in. Current URL:", page.url());
    
    // Sometimes it needs a specific delay or click
    await page.waitForTimeout(5000); 

    const targetUrl = 'https://grupooptico.dyndns.info/smartlab/laboratory/new';
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    
    await page.waitForTimeout(10000); // Wait longer for SPA elements
    
    console.log("Body HTML snippet:");
    const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 1000));
    console.log(bodyText);
    
    // Look for frames if the elements array is empty
    const frames = page.frames();
    console.log(`Found ${frames.length} frames.`);
    
    let allElements = [];
    for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        console.log(`Extracting from frame ${i}: ${frame.url()}`);
        try {
            const elements = await frame.evaluate(() => {
                const els = Array.from(document.querySelectorAll('input, select, textarea'));
                return els.map(el => {
                    const tag = el.tagName.toLowerCase();
                    const name = (el as HTMLInputElement).name || '';
                    const id = el.id || '';
                    const type = (el as HTMLInputElement).type || '';
                    let options = [];
                    if (tag === 'select') {
                        options = Array.from((el as HTMLSelectElement).options).map(o => ({ value: o.value, text: o.text }));
                    }
                    return { tag, name, id, type, options };
                });
            });
            allElements = allElements.concat(elements);
        } catch(e) {
            console.log(`Error extracting from frame ${i}: ${e.message}`);
        }
    }
    
    fs.writeFileSync('/Users/ishtarpissano/.gemini/antigravity/brain/48b0336c-36c9-4f3c-9853-3fa92983d244/scratch/elements2.json', JSON.stringify(allElements, null, 2));
    console.log(`Wrote ${allElements.length} elements to scratch/elements2.json`);
    
    const html = await page.evaluate(() => document.documentElement.outerHTML);
    fs.writeFileSync('/Users/ishtarpissano/.gemini/antigravity/brain/48b0336c-36c9-4f3c-9853-3fa92983d244/scratch/page_laboratory.html', html);

  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    await browser.close();
  }
})();
