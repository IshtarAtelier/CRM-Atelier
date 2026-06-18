const { chromium } = require('playwright');
async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login');
  await page.fill('input[type="text"]', 'pisano.ishtar@gmail.com');
  await page.fill('input[type="password"]', 'atelier');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
  await page.goto('https://grupooptico.dyndns.info/smartlab/laboratory/new');
  await page.waitForTimeout(3000);

  // Click Tipo de aro
  const aroLabel = await page.locator('label').filter({ hasText: /^Tipo de aro$/ });
  const aroParent = aroLabel.locator('..');
  const aroCombo = aroParent.locator('[role="combobox"]');
  await aroCombo.click();
  await page.waitForTimeout(1000);
  
  // Get listbox controlled by aroCombo
  const listboxId = await aroCombo.getAttribute('aria-controls');
  const opts = await page.locator(`ul[id="${listboxId}"] [role="option"]`).allTextContents();
  console.log("Aro options:", opts);
  
  // Close listbox
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  
  // Click Tipo armazón
  const armLabel = await page.locator('label').filter({ hasText: /^Tipo armazón$/ });
  const armParent = armLabel.locator('..');
  const armCombo = armParent.locator('[role="combobox"]');
  await armCombo.click();
  await page.waitForTimeout(1000);
  
  const listboxId2 = await armCombo.getAttribute('aria-controls');
  const opts2 = await page.locator(`ul[id="${listboxId2}"] [role="option"]`).allTextContents();
  console.log("Armazón options:", opts2);

  await browser.close();
}
main().catch(console.error);
