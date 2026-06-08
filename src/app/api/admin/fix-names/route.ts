import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NAME_MAPPING = {
  "G7013 C1": "Atelier Artemis",
  "GS7015 C3": "Atelier Iris",
  "GS7015 C1": "Atelier Calypso",
  "HK011 C5": "Atelier Daphne",
  "TL3684 C4": "Atelier Selene",
  "HK011 C3": "Atelier Pandora",
  "HY238013 C1": "Atelier Gaia",
  "HY238014 C2": "Atelier Minerva",
  "HY238014 C3": "Atelier Clio",
  "HY238014 C4-1": "Atelier Hera",
  "JYB238015 C1": "Atelier Venus",
  "JYB238015 C2-1": "Atelier Aurora",
  "JYB238015 C2": "Atelier Flora",
  "TL3684 C5": "Atelier Freya",
  "TL3932 C3": "Atelier Diana",
  "TL5217 C2": "Atelier Leda",
  "91501 C6": "Atelier Athena",
  "TL3932 C4": "Atelier Ceres",
  "TL5217 C5": "Atelier Thalia"
};

export async function GET() {
  try {
    let updatedProducts = 0;
    let updatedWebProducts = 0;

    for (const [modelCode, newName] of Object.entries(NAME_MAPPING)) {
      const products = await prisma.product.findMany({
        where: { model: { equals: modelCode } }
      });

      for (const p of products) {
        if (p.name !== newName) {
          await prisma.product.update({
            where: { id: p.id },
            data: { name: newName }
          });
          updatedProducts++;
        }
      }

      const webProducts = await prisma.webProduct.findMany({
        where: { product: { model: { equals: modelCode } } }
      });

      for (const wp of webProducts) {
        if (wp.name !== newName) {
          await prisma.webProduct.update({
            where: { id: wp.id },
            data: { name: newName }
          });
          updatedWebProducts++;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `¡Listo! Productos actualizados: ${updatedProducts}, WebProducts actualizados: ${updatedWebProducts}` 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
