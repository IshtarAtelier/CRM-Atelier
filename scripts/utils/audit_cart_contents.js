const { PrismaClient } = require('@prisma/client');
const { chromium } = require('playwright');

const prisma = new PrismaClient();

// Helper to parse base code and color variant from model string
function parseModel(modelStr) {
  const normalized = modelStr.trim().replace(/-([cC]\d+)$/, ' $1');
  const parts = normalized.split(/\s+/);
  if (parts.length > 1) {
    const color = parts[parts.length - 1];
    const base = parts.slice(0, -1).join(' ');
    return { base, color };
  }
  return { base: modelStr, color: 'C1' };
}

async function main() {
  console.log("Querying local DB for expected Atelier products...");
  const expectedProducts = await prisma.product.findMany({
    where: {
      publishToWeb: true,
      brand: {
        equals: 'Atelier',
        mode: 'insensitive'
      }
    },
    select: {
      model: true
    }
  });

  const expectedList = expectedProducts.map(p => {
    const { base, color } = parseModel(p.model);
    return {
      fullModel: p.model,
      base: base.toLowerCase().trim(),
      color: color.toLowerCase().trim()
    };
  });

  console.log(`Expected products count: ${expectedList.length}`);

  console.log("\nLaunching Chromium to read live cart...");
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

  console.log("Navigating to cart page...");
  await page.goto('https://kazwiniopticalgroup.com/cart', { waitUntil: 'networkidle' });

  // Take screenshot for visual audit
  await page.screenshot({ path: '/Users/ishtarpissano/.gemini/antigravity/brain/a963da96-d28d-412d-a3f0-129fc07fd7f5/scratch/cart_audit_screenshot.png', fullPage: true });

  console.log("Extracting products from cart page HTML...");
  const cartItems = await page.evaluate(() => {
    const items = [];
    // The cart table rows
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    
    rows.forEach((row, idx) => {
      const cells = Array.from(row.querySelectorAll('td'));
      if (cells.length < 8) return; // skip header or summary rows
      
      // Column 1: Article/Code (e.g. Q5005 or Q5005-C4 or similar)
      const codeText = cells[0].textContent.trim();
      
      // Column 3: Product title
      const titleText = cells[2].textContent.trim();
      
      // Column 4: Variations/Color
      const variantText = cells[3].textContent.trim();

      // Column 8: Quantity input
      const qtyInput = row.querySelector('input[name="quantity"], input.input-quantity');
      const qtyVal = qtyInput ? parseInt(qtyInput.value || qtyInput.getAttribute('data-js-real-value') || '0', 10) : 0;
      
      items.push({
        index: idx,
        code: codeText,
        title: titleText,
        variant: variantText,
        quantity: qtyVal
      });
    });
    
    return items;
  });

  console.log(`Extracted ${cartItems.length} items from cart page.`);
  
  // Parse cart items for comparison
  const parsedCart = cartItems.map(item => {
    // Some cart pages list variation in Column 4 (color name/code) and base code in Column 1
    // Let's normalize base and color
    const baseCode = item.code.trim().replace('◆', '').trim();
    const colorCode = item.variant.trim();
    return {
      original: item,
      base: baseCode.toLowerCase(),
      color: colorCode.toLowerCase(),
      quantity: item.quantity
    };
  });

  // Perform comparison
  const matched = [];
  const qtyMismatch = [];
  const missing = [];

  for (const expected of expectedList) {
    // Find matching item in cart
    const found = parsedCart.find(c => {
      // Check if cart base code matches expected base code
      // And cart variant matches expected color
      const baseMatch = c.base === expected.base || expected.base.includes(c.base) || c.base.includes(expected.base);
      const colorMatch = c.color === expected.color || c.color.includes(expected.color) || expected.color.includes(c.color);
      return baseMatch && colorMatch;
    });

    if (found) {
      if (found.quantity === 5) {
        matched.push({ expected, cart: found });
      } else {
        qtyMismatch.push({ expected, cart: found });
      }
    } else {
      missing.push(expected);
    }
  }

  // Find extra items in cart not expected
  const extras = parsedCart.filter(c => {
    const isExpected = expectedList.some(e => {
      const baseMatch = c.base === e.base || e.base.includes(c.base) || c.base.includes(e.base);
      const colorMatch = c.color === e.color || c.color.includes(e.color) || e.color.includes(c.color);
      return baseMatch && colorMatch;
    });
    return !isExpected;
  });

  console.log("\n=================== AUDIT RESULTS ===================");
  console.log(`- Total expected products: ${expectedList.length}`);
  console.log(`- Correctly added (Qty: 5): ${matched.length}`);
  console.log(`- Incorrect quantity: ${qtyMismatch.length}`);
  console.log(`- Missing completely: ${missing.length}`);
  console.log(`- Extra items in cart (not in expected list): ${extras.length}`);
  console.log("=====================================================");

  if (qtyMismatch.length > 0) {
    console.log("\n[WARNING] Products with incorrect quantity:");
    qtyMismatch.forEach(m => {
      console.log(`- Model: "${m.expected.fullModel}" | Cart Quantity: ${m.cart.quantity} (Expected: 5)`);
    });
  }

  if (missing.length > 0) {
    console.log("\n[WARNING] Missing products from cart:");
    missing.forEach(m => {
      console.log(`- Model: "${m.expected.fullModel}"`);
    });
  }

  if (extras.length > 0) {
    console.log("\n[NOTE] Extra products currently in cart:");
    extras.forEach(e => {
      console.log(`- Code: "${e.original.code}" | Variant: "${e.original.variant}" | Qty: ${e.quantity}`);
    });
  }

  // Create a structured report markdown file for the user
  const reportPath = '/Users/ishtarpissano/.gemini/antigravity/brain/a963da96-d28d-412d-a3f0-129fc07fd7f5/cart_audit_report.md';
  const fs = require('fs');
  let md = `# Shopping Cart Audit Report\n\n`;
  md += `Audit completed on: ${new Date().toLocaleString()}\n\n`;
  md += `## Summary Table\n\n`;
  md += `| Category | Count |\n`;
  md += `| :--- | :--- |\n`;
  md += `| Expected active catalog models | **${expectedList.length}** |\n`;
  md += `| Correctly in cart (Qty: 5) | **${matched.length}** |\n`;
  md += `| Quantity mismatch | **${qtyMismatch.length}** |\n`;
  md += `| Missing completely | **${missing.length}** |\n`;
  md += `| Extra items in cart | **${extras.length}** |\n\n`;

  if (missing.length > 0) {
    md += `## ⚠️ Missing Products\n\n`;
    missing.forEach(m => {
      md += `- [ ] \`${m.fullModel}\`\n`;
    });
    md += `\n`;
  } else {
    md += `## ✅ No Missing Products\n\nAll expected catalog models are present in the cart!\n\n`;
  }

  if (qtyMismatch.length > 0) {
    md += `## ⚠️ Quantity Mismatches\n\n`;
    qtyMismatch.forEach(m => {
      md += `- \`${m.expected.fullModel}\` has **${m.cart.quantity}** units in cart (Expected: 5)\n`;
    });
    md += `\n`;
  }

  if (extras.length > 0) {
    md += `## ℹ️ Extra Products in Cart\n\n`;
    extras.forEach(e => {
      md += `- \`${e.original.code}\` (Variant: \`${e.original.variant}\`) - Qty: ${e.quantity}\n`;
    });
  }

  fs.writeFileSync(reportPath, md);
  console.log(`\nAudit report written to: ${reportPath}`);

  await prisma.$disconnect();
  await browser.close();
}

main().catch(console.error);
