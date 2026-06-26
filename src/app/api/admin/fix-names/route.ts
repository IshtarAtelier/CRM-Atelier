import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NAME_MAPPING = {
  "G7013 C1": "Artemis",
  "GS7015 C3": "Iris",
  "GS7015 C1": "Calypso",
  "HK011 C5": "Daphne",
  "TL3684 C4": "Selene",
  "HK011 C3": "Pandora",
  "HY238013 C1": "Gaia",
  "HY238014 C2": "Minerva",
  "HY238014 C3": "Clio",
  "HY238014 C4-1": "Hera",
  "JYB238015 C1": "Venus",
  "JYB238015 C2-1": "Aurora",
  "JYB238015 C2": "Flora",
  "TL3684 C5": "Freya",
  "TL3932 C3": "Diana",
  "TL5217 C2": "Leda",
  "91501 C6": "Athena",
  "TL3932 C4": "Ceres",
  "TL5217 C5": "Thalia",
  "M7011 C4": "Hebe",
  "M7027 C4": "Calliope",
  "M7033 C1": "Hestia",
  "M7033 C2": "Astraea",
  "M7237 C1": "Ariadne",
  "M7237 C2": "Circe",
  "M7239 C4": "Clotho",
  "TL3704A C4": "Electra",
  "TL3704A C5": "Euterpe",
  "TL3932 C2": "Leto",
  "TL5206 C4": "Maia",
  "TL5207 C4": "Niobe",
  "TL5208 C2": "Rhea",
  "TL5213 C4": "Semele",
  "TL5217 C4": "Vesta",
  "9004M C2": "Poseidon",
  "9004M C3": "Dionisio",
  "9004M C5": "Zeus",
  "9004M C6": "Apolo",
  "9006M C1": "Hermes",
  "9006M C2": "Ares",
  "9006M C3": "Hades",
  "9006M C4": "Hefesto",
  "TG2807 C1": "Helios",
  "TG2809 C1": "Teseo",
  "TG2809 C4": "Heracles",
  "TG2810 C1": "Aquiles",
  "TG2810 C4": "Perseo",
  "V99011 C4": "Ulises",
  "V99018 C1": "Cronos",
  "V99018 C3": "Prometeo",
  "YX05 C1": "Orfeo",
  "YX05 C2": "Eros",
  "YX05 C3": "Baco",
  "YX05 C4": "Atlas"
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
