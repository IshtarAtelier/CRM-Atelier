import { chromium } from 'playwright';
import path from 'path';

async function main() {
    console.log('Starting browser...');
    const browsersPath = path.join(process.cwd(), '.playwright-browsers');
    process.env.PLAYWRIGHT_BROWSERS_PATH = browsersPath;
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        console.log('Logging in...');
        await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login', { waitUntil: 'networkidle' });
        await page.waitForSelector('input', { timeout: 10000 });
        
        const inputs = await page.$$('input');
        await inputs[0].fill('pisano.ishtar@gmail.com');
        await inputs[1].fill('atelier');
        
        const buttons = await page.$$('button');
        for (const btn of buttons) {
            const text = await btn.innerText();
            if (text.toLowerCase().includes('iniciar') || text.toLowerCase().includes('ingresar') || text.toLowerCase().includes('login')) {
                await btn.click();
                break;
            }
        }
        
        await page.waitForURL('**/smartlab**', { timeout: 15000 });
        console.log('Logged in. Navigating to new order...');
        
        await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new', { waitUntil: 'networkidle' });
        await page.waitForTimeout(5000); // Wait for MUI to render
        
        console.log('Extracting comboboxes...');
        // Find all comboboxes (autocompletes)
        const comboboxes = await page.$$('[role="combobox"]');
        const results: Record<string, string[]> = {};
        
        for (let i = 0; i < comboboxes.length; i++) {
            const cb = comboboxes[i];
            const labelEl = await page.evaluateHandle((el) => {
                let current = el;
                while (current && current.tagName !== 'DIV') {
                    current = current.parentElement;
                }
                if (current && current.parentElement) {
                    const label = current.parentElement.querySelector('label');
                    return label ? label.innerText : null;
                }
                return null;
            }, cb);
            
            const labelText = await labelEl.jsonValue() as string;
            if (!labelText) continue;
            
            console.log(`Clicking combobox: ${labelText}`);
            try {
                await cb.click();
                await page.waitForTimeout(1000); // Wait for options to appear
                
                // Get all options in the listbox
                const options = await page.$$eval('[role="option"]', opts => opts.map(o => o.textContent?.trim() || ''));
                if (options.length > 0) {
                    results[labelText] = options.filter(o => o);
                }
                
                // Click outside to close
                await page.keyboard.press('Escape');
                await page.waitForTimeout(500);
            } catch (e) {
                console.log(`Failed to extract options for ${labelText}`);
            }
        }
        
        console.log('\n--- EXTRACTED OPTIONS ---');
        console.log(JSON.stringify(results, null, 2));
        
        console.log('\nExtracting radio buttons (Tratamientos)...');
        const radios = await page.$$eval('input[type="radio"]', inputs => {
            return inputs.map(input => {
                const label = input.closest('label');
                return label ? label.textContent?.trim() || '' : '';
            }).filter(t => t);
        });
        console.log('Radios:', radios);
        
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
