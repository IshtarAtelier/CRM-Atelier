const { chromium } = require('playwright');

async function main() {
  console.log("Launching browser to inspect cart page...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Logging in to Kazwini...");
  await page.goto('https://kazwiniopticalgroup.com', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const emailInput = document.getElementById('landing-login-email');
    const passInput = document.getElementById('landing-login-password');
    if (emailInput) emailInput.value = 'pissano@kazwini.com';
    if (passInput) passInput.value = 'pissano2025';
    
    const form = document.getElementById('landing-login-form');
    if (form) {
      const event = new Event('submit', { cancelable: true, bubbles: true });
      form.dispatchEvent(event);
    }
  });

  await page.waitForTimeout(5000);

  console.log("Navigating to https://kazwiniopticalgroup.com/cart...");
  await page.goto('https://kazwiniopticalgroup.com/cart', { waitUntil: 'networkidle' });

  // Take screenshot of the cart page
  console.log("Taking screenshot of cart page...");
  await page.screenshot({ path: '/Users/ishtarpissano/.gemini/antigravity/brain/a963da96-d28d-412d-a3f0-129fc07fd7f5/scratch/cart_page_inspection.png', fullPage: true });

  // Analyze page structure (buttons, inputs, forms)
  const inspection = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button, a')).map(el => {
      return {
        tag: el.tagName,
        text: el.textContent.trim(),
        id: el.id,
        className: el.className,
        href: el.href || null,
        onclick: el.getAttribute('onclick')
      };
    });

    const forms = Array.from(document.querySelectorAll('form')).map(form => {
      const inputs = Array.from(form.querySelectorAll('input, select, textarea')).map(input => {
        return {
          name: input.name,
          type: input.type || input.tagName,
          id: input.id,
          value: input.value
        };
      });
      return {
        id: form.id,
        action: form.action,
        method: form.method,
        inputs: inputs
      };
    });

    const bodyText = document.body.textContent;
    const hasOrderButton = bodyText.includes("Finalizar") || bodyText.includes("Pedido") || bodyText.includes("Checkout") || bodyText.includes("Confirmar");

    return {
      buttons: buttons.filter(b => b.text.length > 0),
      forms: forms,
      hasOrderButton: hasOrderButton,
      pageTitle: document.title
    };
  });

  console.log(`\nPage Title: "${inspection.pageTitle}"`);
  console.log(`\nForms found on cart page: ${inspection.forms.length}`);
  inspection.forms.forEach((f, idx) => {
    console.log(`Form #${idx + 1}: ID="${f.id}" | Action="${f.action}" | Method="${f.method}"`);
    f.inputs.forEach(i => {
      console.log(`  - Input: name="${i.name}" | type="${i.type}" | id="${i.id}"`);
    });
  });

  console.log(`\nProminent buttons/links on cart page:`);
  inspection.buttons.forEach((b, idx) => {
    if (b.text.toLowerCase().includes('finalizar') || b.text.toLowerCase().includes('pedido') || b.text.toLowerCase().includes('comprar') || b.text.toLowerCase().includes('checkout') || b.text.toLowerCase().includes('confirmar') || b.text.toLowerCase().includes('enviar')) {
      console.log(`- Button #${idx + 1}: Text="${b.text}" | ID="${b.id}" | Class="${b.className}" | Href="${b.href}"`);
    }
  });

  await browser.close();
}

main().catch(console.error);
