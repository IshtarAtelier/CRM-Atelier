const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getAfipInstance } = require('./src/lib/afip');

async function fixInvoice() {
  try {
    const afip = getAfipInstance('ISH');
    // Get the last voucher emitted (which is the one that got orphaned)
    const lastVoucher = await afip.ElectronicBilling.getLastVoucher(3, 11).catch(() => 1);
    
    console.log(`Last voucher in AFIP: ${lastVoucher}`);

    // Insert it into Prisma so it shows up in the CRM!
    const invoice = await prisma.invoice.create({
      data: {
        orderId: "cmnz137tg000w88vzxonx180f",
        cae: "86161914321109",
        caeExpiration: "2026-04-27",
        voucherNumber: lastVoucher,
        voucherType: 11,
        pointOfSale: 3,
        concept: 1,
        totalAmount: 160194,
        docType: 96,
        docNumber: "44490849",
        billingAccount: "ISH",
        status: "COMPLETED"
      }
    });

    console.log("Invoice created successfully!", invoice.id);
  } catch (error) {
    console.error("Failed to insert invoice:", error);
  } finally {
    await prisma.$disconnect();
  }
}

fixInvoice();
