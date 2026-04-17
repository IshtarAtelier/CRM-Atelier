import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixInvoice() {
  try {
    // Insert it into Prisma so it shows up in the CRM!
    const invoice = await prisma.invoice.create({
      data: {
        orderId: "cmnz137tg000w88vzxonx180f",
        cae: "86161914321109",
        caeExpiration: "2026-04-27",
        voucherNumber: 1, // First invoice on point 3 ever
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
