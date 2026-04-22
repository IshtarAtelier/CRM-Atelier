/**
 * seed-pricing.ts
 * Carga inicial de precios del bot de WhatsApp (Matías - Atelier Óptica).
 * Ejecutar con: npx ts-node prisma/seed-pricing.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const prices = [
  // ── MULTIFOCALES VARILUX (3 opciones principales para el bot) ─────────────
  {
    name: 'Smart Lens FREE – Gama Alta',
    description: 'Multifocal con antirreflejo Essential + Filtro luz azul. Tallado digital.',
    category: 'MULTIFOCAL',
    subcategory: 'SMART_LENS',
    priceCash: 550000,
    priceCredit: 637000,
    creditMonths: 6,
    notes: 'Opción económica recomendada. 2x1 en armazón. 7 días hábiles.',
    sortOrder: 10,
  },
  {
    name: 'Varilux Comfort Max AR Crizal – Gama Superior',
    description: 'Multifocal con Antirreflejo Crizal + Filtro luz azul. Tallado digital.',
    category: 'MULTIFOCAL',
    subcategory: 'VARILUX',
    priceCash: 1020000,
    priceCredit: 1200000,
    creditMonths: 6,
    notes: 'Opción media recomendada. 2x1 en armazón. 10 días hábiles.',
    sortOrder: 20,
  },
  {
    name: 'Varilux XR-Design IA AR Crizal – Gama Premium',
    description: 'Multifocal con Inteligencia Artificial + Antirreflejo Crizal + Filtro azul.',
    category: 'MULTIFOCAL',
    subcategory: 'VARILUX',
    priceCash: 1350000,
    priceCredit: 1600000,
    creditMonths: 6,
    notes: 'Opción premium. IA incluida. 2x1 en armazón. 10 días hábiles.',
    sortOrder: 30,
  },
  {
    name: 'Mi Primer Varilux 50% OFF – Comfort Max AR Crizal',
    description: 'Promo primer Varilux. Solo para add hasta +1.50, primera vez.',
    category: 'MULTIFOCAL',
    subcategory: 'PROMO',
    priceCash: 450000,
    priceCredit: 550000,
    creditMonths: 6,
    notes: 'Solo si add < +1.50 y nunca usó Varilux antes.',
    sortOrder: 5,
  },

  // ── BIFOCALES ─────────────────────────────────────────────────────────────
  {
    name: 'Bifocal Promo + Armazón de regalo',
    description: 'Bifocal con armazón incluido.',
    category: 'BIFOCAL',
    subcategory: 'PROMO',
    priceCash: 95000,
    priceCredit: 120000,
    creditMonths: 6,
    sortOrder: 10,
  },

  // ── MONOFOCALES STOCK ─────────────────────────────────────────────────────
  {
    name: 'Orgánico 1.56 BlueCut + Antirreflejo',
    description: 'Monofocal orgánico índice 1.56 con filtro azul y antirreflejo.',
    category: 'MONOFOCAL',
    subcategory: 'STOCK',
    priceCash: 52100,
    priceCredit: 61250,
    creditMonths: 6,
    notes: 'Stock hasta ESF -6.00 / CIL -2.00',
    sortOrder: 10,
  },
  {
    name: 'Orgánico 1.60 SUPER HD BlueCut + Antirreflejo',
    description: 'Monofocal 1.60 HD con filtro azul y antirreflejo.',
    category: 'MONOFOCAL',
    subcategory: 'STOCK',
    priceCash: 95200,
    priceCredit: 112000,
    creditMonths: 6,
    notes: 'Stock hasta ESF -6.00 / CIL -2.00',
    sortOrder: 20,
  },
  {
    name: 'Orgánico 1.67 Stylis BlueCut + Antirreflejo',
    description: 'Monofocal 1.67 delgado con filtro azul y antirreflejo.',
    category: 'MONOFOCAL',
    subcategory: 'STOCK',
    priceCash: 220220,
    priceCredit: 253000,
    creditMonths: 6,
    notes: 'Stock hasta ESF -6.00 / CIL -2.00',
    sortOrder: 30,
  },
  {
    name: 'Smart Lens Fotocromático',
    description: 'Monofocal que se oscurece con la luz solar.',
    category: 'MONOFOCAL',
    subcategory: 'STOCK',
    priceCash: 145000,
    priceCredit: 166750,
    creditMonths: 6,
    sortOrder: 40,
  },
  {
    name: 'Policarbonato con Antirreflejo',
    description: 'Monofocal policarbonato resistente a impactos.',
    category: 'MONOFOCAL',
    subcategory: 'STOCK',
    priceCash: 80750,
    priceCredit: 95000,
    creditMonths: 6,
    sortOrder: 50,
  },

  // ── MONOFOCALES LABORATORIO ───────────────────────────────────────────────
  {
    name: 'Lab 1.60 SUPER HD Digital BlueCut + AR',
    description: 'Laboratorio 1.60 tallado digital para recetas altas.',
    category: 'MONOFOCAL',
    subcategory: 'LABORATORIO',
    priceCash: 334080,
    priceCredit: 417600,
    creditMonths: 6,
    notes: 'Para ESF > ±6.00 o CIL > ±2.00',
    sortOrder: 10,
  },
  {
    name: 'Lab 1.67 Stylis Digital BlueCut + AR',
    description: 'Laboratorio 1.67 tallado digital.',
    category: 'MONOFOCAL',
    subcategory: 'LABORATORIO',
    priceCash: 376754,
    priceCredit: 470943,
    creditMonths: 6,
    notes: 'Para ESF > ±6.00 o CIL > ±2.00',
    sortOrder: 20,
  },
  {
    name: 'Lab 1.74 Digital',
    description: 'Laboratorio 1.74 ultra delgado, máxima estética.',
    category: 'MONOFOCAL',
    subcategory: 'LABORATORIO',
    priceCash: 601585,
    priceCredit: 751981,
    creditMonths: 6,
    notes: 'Para recetas muy altas.',
    sortOrder: 30,
  },

  // ── CONTROL MIOPÍA NIÑOS ──────────────────────────────────────────────────
  {
    name: 'Smart Lens MyoFix – Control Miopía Niños',
    description: 'Cristal para controlar el avance de la miopía en niños.',
    category: 'MONOFOCAL',
    subcategory: 'CONTROL_MIOPIA_NINOS',
    priceCash: 375000,
    priceCredit: 431250,
    creditMonths: 6,
    sortOrder: 10,
  },
  {
    name: 'ESSILOR myiopiluX LITE – Control Miopía Niños',
    description: 'Lente Essilor gama alta para control de miopía infantil.',
    category: 'MONOFOCAL',
    subcategory: 'CONTROL_MIOPIA_NINOS',
    priceCash: 532400,
    priceCredit: 612260,
    creditMonths: 6,
    sortOrder: 20,
  },
  {
    name: 'ESSILOR myiopiluX PLUS – Control Miopía Niños',
    description: 'Lente Essilor gama exclusiva para control de miopía infantil.',
    category: 'MONOFOCAL',
    subcategory: 'CONTROL_MIOPIA_NINOS',
    priceCash: 665742,
    priceCredit: 765603,
    creditMonths: 6,
    sortOrder: 30,
  },

  // ── CONTROL MIOPÍA ADULTOS ────────────────────────────────────────────────
  {
    name: 'Smart Lens MyoLens – Control Miopía Adultos',
    description: 'Lente para miopía progresiva o fatiga visual por pantallas.',
    category: 'MONOFOCAL',
    subcategory: 'CONTROL_MIOPIA_ADULTOS',
    priceCash: 226270,
    priceCredit: 260210,
    creditMonths: 6,
    sortOrder: 10,
  },
  {
    name: 'Smart Lens MyoLens SUPER BLUE HD – Control Miopía Adultos',
    description: 'Versión alta con filtro azul HD.',
    category: 'MONOFOCAL',
    subcategory: 'CONTROL_MIOPIA_ADULTOS',
    priceCash: 308550,
    priceCredit: 354832,
    creditMonths: 6,
    sortOrder: 20,
  },
  {
    name: 'EyeZen Start Monofocal ESSILOR',
    description: 'Monofocal Essilor para aliviar la fatiga visual digital.',
    category: 'MONOFOCAL',
    subcategory: 'CONTROL_MIOPIA_ADULTOS',
    priceCash: 377551,
    priceCredit: 434184,
    creditMonths: 6,
    sortOrder: 30,
  },

  // ── LENTES DE CONTACTO ────────────────────────────────────────────────────
  {
    name: 'Bausch & Lomb SofLens 59 – Promo 2 cajas (6 pares)',
    description: 'Lentes de contacto blandas mensuales. 2 cajas al precio de 1.',
    category: 'CONTACTO',
    subcategory: 'MENSUAL',
    priceCash: 102000,
    priceCredit: 120000,
    creditMonths: 6,
    notes: 'Cada caja = 3 pares. Pueden ser graduaciones distintas.',
    sortOrder: 10,
  },

  // ── ARMAZONES (precios representativos por marca) ─────────────────────────
  {
    name: 'Armazón Atelier / Wellington Polo Club',
    description: 'Armazón de receta marca Atelier o Wellington Polo Club.',
    category: 'ARMAZON',
    subcategory: 'ECONOMICO',
    priceCash: 102000,
    priceCredit: 120000,
    creditMonths: 6,
    sortOrder: 10,
  },
  {
    name: 'Armazón AY NOT DEAD / CIMA / Mistral / Prototype / Paul Riviere',
    description: 'Armazones de receta gama media.',
    category: 'ARMAZON',
    subcategory: 'MEDIO',
    priceCash: 160000,
    priceCredit: 187000,
    creditMonths: 6,
    sortOrder: 20,
  },
  {
    name: 'Armazón Ossira / Wanama / Prune / Reef / Orbital / Karun / Tiffany',
    description: 'Armazones de receta gama media-alta.',
    category: 'ARMAZON',
    subcategory: 'MEDIO_ALTO',
    priceCash: 194000,
    priceCredit: 229400,
    creditMonths: 6,
    sortOrder: 30,
  },
  {
    name: 'Wicue – Lentes Inteligentes (Gafas de Sol)',
    description: 'Gafas de sol que se oscurecen con un botón. Polarizadas. Sin graduación.',
    category: 'ARMAZON',
    subcategory: 'ESPECIAL',
    priceCash: 748000,
    priceCredit: 880000,
    creditMonths: 6,
    notes: 'No admiten graduación. Link: https://atelieroptica.com.ar/productos/gafasinteligentes/',
    sortOrder: 40,
  },
];

async function main() {
  console.log('🌱 Cargando precios del bot...');

  // Elimina precios existentes para re-seedear limpio
  await prisma.servicePricing.deleteMany();

  for (const price of prices) {
    await prisma.servicePricing.create({ data: price });
  }

  console.log(`✅ ${prices.length} precios cargados correctamente.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
