import { chromium } from 'playwright';
import * as fs from 'fs';

(async () => {
  // Use headless: false if debugging, but headless: true for background
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    console.log("Navigating to login page...");
    await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login', { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for the login form to be attached
    await page.waitForSelector('input', { state: 'attached', timeout: 30000 });

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
                page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {}),
                btn.click()
            ]);
            break;
        }
    }

    console.log("Logged in successfully. Current URL:", page.url());
    
    // Wait for any post-login redirects or dashboards to load
    await page.waitForTimeout(5000); 

    // The 'Nuevo Pedido' links available in the dashboard:
    const targetUrls = [
        'https://grupooptico.dyndns.info/smartlab/laboratory/new', // Laboratorio / Armazones
        'https://grupooptico.dyndns.info/smartlab/crystal/new'     // Cristales
    ];

    let allExtractedElements = {};

    for (const targetUrl of targetUrls) {
        console.log(`\nNavigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        // Wait longer for SPA elements to render
        await page.waitForTimeout(10000); 
        
        let allElements = [];

        // Check the main page and all iframes
        const frames = page.frames();
        console.log(`Found ${frames.length} frame(s) on ${targetUrl}.`);
        
        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            try {
                const elements = await frame.evaluate(() => {
                    const els = Array.from(document.querySelectorAll('input, select, textarea'));
                    return els.map(el => {
                        const tag = el.tagName.toLowerCase();
                        const name = (el as HTMLInputElement).name || '';
                        const id = el.id || '';
                        const type = (el as HTMLInputElement).type || '';
                        const labelText = el.closest('label')?.innerText || el.parentElement?.innerText || '';
                        let options = [];
                        if (tag === 'select') {
                            options = Array.from((el as HTMLSelectElement).options).map(o => ({ value: o.value, text: o.text.trim() }));
                        }
                        return { tag, name, id, type, labelText: labelText.substring(0, 30).trim(), options };
                    });
                });
                allElements = allElements.concat(elements);
            } catch(e) {
                console.log(`Error extracting from frame ${i}: ${e.message}`);
            }
        }

        console.log(`Extracted ${allElements.length} elements from ${targetUrl}`);
        allExtractedElements[targetUrl] = allElements;
    }
    
    const outputPath = 'extracted_elements.json';
    fs.writeFileSync(outputPath, JSON.stringify(allExtractedElements, null, 2));
    console.log(`\nExtraction complete. Results saved to ${outputPath}`);

  } catch (error) {
    console.error("Error occurred:", error);
  } finally {
    await browser.close();
  }
})();
