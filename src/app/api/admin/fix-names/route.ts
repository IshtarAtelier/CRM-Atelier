import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NAME_MAPPING = {
  // Metal Femenino
  "G7013 C1": "Artemis",
  "GS7015 C3": "Iris C3",
  "GS7015 C1": "Iris C1",
  "HK011 C5": "Pandora C5",
  "HK011 C3": "Pandora C3",
  "HY238013 C1": "Gaia C1",
  "HY238014 C2": "Minerva C2",
  "HY238014 C3": "Minerva C3",
  "HY238014 C4-1": "Minerva C4-1",
  "JYB238015 C1": "Venus C1",
  "JYB238015 C2-1": "Venus C2-1",
  "JYB238015 C2": "Venus C2",
  "TL3684 C4": "Selene C4",
  "TL3684 C5": "Selene C5",
  "TL3932 C3": "Diana C3",
  "TL3932 C4": "Diana C4",
  "TL3932 C2": "Diana C2",
  "TL5217 C2": "Leda C2",
  "TL5217 C4": "Leda C4",
  "TL5217 C5": "Leda C5",
  "TL5206 C4": "Maia C4",
  "TL5207 C4": "Niobe C4",
  "TL5208 C2": "Rhea C2",
  "TL5213 C4": "Semele C4",
  "TL5217 C4": "Vesta C4",
  "M7011 C4": "Hebe C4",
  "M7027 C4": "Calliope C4",
  "M7033 C1": "Hestia C1",
  "M7033 C2": "Hestia C2",
  "M7237 C1": "Ariadne C1",
  "M7237 C2": "Ariadne C2",
  "M7239 C4": "Clotho C4",
  "TL3704A C4": "Electra C4",
  "TL3704A C5": "Euterpe C5",
  
  // Metal Masculino
  "9004M C2": "Poseidon C2",
  "9004M C3": "Poseidon C3",
  "9004M C5": "Poseidon C5",
  "9004M C6": "Poseidon C6",
  "9006M C1": "Hermes C1",
  "9006M C2": "Hermes C2",
  "9006M C3": "Hermes C3",
  "9006M C4": "Hermes C4",
  "TG2807 C1": "Helios C1",
  "TG2809 C1": "Teseo C1",
  "TG2809 C4": "Teseo C4",
  "TG2810 C1": "Aquiles C1",
  "TG2810 C4": "Aquiles C4",
  "V99011 C4": "Ulises C4",
  "V99018 C1": "Cronos C1",
  "V99018 C3": "Cronos C3",
  "YX05 C1": "Orfeo C1",
  "YX05 C2": "Orfeo C2",
  "YX05 C3": "Orfeo C3",
  "YX05 C4": "Orfeo C4",

  // Acetatos Unisex
  "57201LJH-C1": "Andrómeda C1",
  "57201LJH-C3": "Andrómeda C3",
  "57201LJH-C4": "Andrómeda C4",
  "57201LJH-C6": "Andrómeda C6",
  "57201LJH-C7": "Andrómeda C7",
  "57202LJH-C1": "Polaris C1",
  "57202LJH-C2": "Polaris C2",
  "57202LJH-C5": "Polaris C5",
  "57202LJH-C6": "Polaris C6",
  "57202LJH-C7": "Polaris C7",
  "BC3063-C1": "Pegaso C1"
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
