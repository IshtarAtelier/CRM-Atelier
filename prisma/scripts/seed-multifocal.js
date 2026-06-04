// Seed: Cristales Multifocales — Varilux, Smart, Sygnus, Kodak
// Organizado por Marca → Línea → Índice ascendente
// Precios y costos en ARS (sin IVA), unidad: PAR

const { PrismaClient } = require('../prisma/generated/client');
const prisma = new PrismaClient();

const crystals = [

  // ═══════════════════════════════════════════════════════════════
  //  VARILUX — MI PRIMER VARILUX (sin tratamiento Crizal)
  // ═══════════════════════════════════════════════════════════════
  { brand: 'Varilux', name: 'COMFORT MAX - ORMA MI PRIMER VARILUX',                           lensIndex: '1.5',  price: 567732,     cost: 391000 },
  { brand: 'Varilux', name: 'COMFORT MAX - AIRWEAR 1.59 MI PRIMER VARILUX',                   lensIndex: '1.59', price: 624360,     cost: 430000 },
  { brand: 'Varilux', name: 'COMFORT MAX - STYLIS 1.67 MI PRIMER VARILUX',                    lensIndex: '1.67', price: 656304,     cost: 452000 },
  { brand: 'Varilux', name: 'COMFORT MAX - ORMA TRANSITIONS GEN S MI PRIMER VARILUX',         lensIndex: 'Foto', price: 836352,     cost: 576000 },

  // ═══════════════════════════════════════════════════════════════
  //  SMART FREE (2x1 — Grupo Óptico)
  // ═══════════════════════════════════════════════════════════════
  { brand: 'Smart', name: 'SMART FREE - Orgánico Blue Light AR Essential 2x1',                       lensIndex: '1.56', price: 646250,     cost: 175000,    laboratory: 'GRUPO OPTICO' },
  { brand: 'Smart', name: 'SMART FREE - Orgánico Blue Light AR Essential Fotocromático Gris 2x1',    lensIndex: '1.56', price: 1058145,    cost: 228000,    laboratory: 'GRUPO OPTICO' },
  { brand: 'Smart', name: 'SMART FREE - Policarbonato Blue Light AR Essential 2x1',                  lensIndex: '1.56', price: 981612.50,  cost: 205000,    laboratory: 'GRUPO OPTICO' },
  { brand: 'Smart', name: 'SMART FREE - Stylis Blue Light 2x1',                                     lensIndex: '1.67', price: 998250,     cost: 210000,    laboratory: 'GRUPO OPTICO' },
  { brand: 'Smart', name: 'SMART FREE - Stylis Fotocromático 2x1',                                  lensIndex: '1.67', price: 1157970,    cost: 258000,    laboratory: 'GRUPO OPTICO' },
  { brand: 'Smart', name: 'SMART FREE - Stylis Blanco 2x1',                                         lensIndex: '1.74', price: 1287742.50, cost: 297000,    laboratory: 'GRUPO OPTICO' },

  // ═══════════════════════════════════════════════════════════════
  //  SYGNUS — ESSILOR NEW EDITIONS (2x1 — Optovision)
  // ═══════════════════════════════════════════════════════════════
  // Orma 1.50
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orma 1.50 BLUE UV + AR Numax 2x1',                              lensIndex: '1.5',  price: 1079289.75, cost: 164850,    laboratory: 'OPTOVISION' },
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orma Transitions GEN S 1.50 + AR Numax 2x1',                     lensIndex: '1.5',  price: 1697388,    cost: 310800,    laboratory: 'OPTOVISION' },
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orma Acclimates 1.50 + AR Numax (Foto Gris) 2x1',               lensIndex: '1.5',  price: 1332754.50, cost: 224700,    laboratory: 'OPTOVISION' },
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orma Xperio 1.50 + AR Numax (Sol) 2x1',                         lensIndex: '1.5',  price: 1697388,    cost: 310800,    laboratory: 'OPTOVISION' },
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orgánico Espejado (Azul/Plata) + AR Numax 2x1',                 lensIndex: '1.5',  price: 1185166.87, cost: 189850.50, laboratory: 'OPTOVISION' },
  // Orgánico Fotosensible 1.56
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Orgánico Fotosensible BLC + AR Numax 2x1',                       lensIndex: '1.56', price: 1274346.44, cost: 210908.25, laboratory: 'OPTOVISION' },
  // Airwear 1.59
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Airwear 1.59 + AR Numax 2x1',                                   lensIndex: '1.59', price: 1168224.75, cost: 185850,    laboratory: 'OPTOVISION' },
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Airwear 1.59 BLUE UV + AR Numax 2x1',                           lensIndex: '1.59', price: 1215049.03, cost: 196906.50, laboratory: 'OPTOVISION' },
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Airwear 1.59 Transitions GEN S + AR Numax 2x1',                 lensIndex: '1.59', price: 1897202.71, cost: 357981.75, laboratory: 'OPTOVISION' },
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Airwear 1.59 Xperio + AR Numax 2x1',                            lensIndex: '1.59', price: 1897202.71, cost: 357981.75, laboratory: 'OPTOVISION' },
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Policarbonato Polarizado Espejado (Azul/Plata) + AR Numax 2x1', lensIndex: '1.59', price: 1363992.92, cost: 232076.25, laboratory: 'OPTOVISION' },
  // Stylis 1.67
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Stylis 1.67 + AR Numax 2x1',                                    lensIndex: '1.67', price: 1473249.57, cost: 257874.75, laboratory: 'OPTOVISION' },
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Stylis 1.67 BLUE UV + AR Numax 2x1',                            lensIndex: '1.67', price: 1540951.34, cost: 273861,    laboratory: 'OPTOVISION' },
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Stylis 1.67 Transitions GEN S + AR Numax 2x1',                  lensIndex: '1.67', price: 2159138.52, cost: 419832,    laboratory: 'OPTOVISION' },
  // Alto Índice 1.74
  { brand: 'Sygnus', name: 'ESSILOR NEW EDITIONS - Alto Índice 1.74 + AR Numax 2x1',                               lensIndex: '1.74', price: 1630597.82, cost: 295029,    laboratory: 'OPTOVISION' },

  // ═══════════════════════════════════════════════════════════════
  //  KODAK — UNIQUE DRO (2x1 — Optovision)
  // ═══════════════════════════════════════════════════════════════
  { brand: 'Kodak', name: 'UNIQUE DRO ORMA BLUE UV 2x1',                                   lensIndex: '1.5',  price: 1148853.48, cost: 255260.25, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'UNIQUE DRO ORMA ACCLIMATES (Foto Gris) 2x1',                    lensIndex: '1.5',  price: 1393040.41, cost: 328644.75, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'UNIQUE DRO ORMA TRANSITIONS GEN S 2x1',                         lensIndex: '1.5',  price: 1699680.35, cost: 420798,    laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'UNIQUE DRO ORMA XPERIO 2x1',                                    lensIndex: '1.5',  price: 1699680.35, cost: 420798,    laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'UNIQUE DRO AIRWEAR 1.59 2x1',                                   lensIndex: '1.59', price: 1114648.45, cost: 244980.75, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'UNIQUE DRO AIRWEAR 1.59 BLUE UV 2x1',                           lensIndex: '1.59', price: 1148853.48, cost: 255260.25, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'UNIQUE DRO AIRWEAR 1.59 TRANSITIONS GEN S 2x1',                 lensIndex: '1.59', price: 1814751.12, cost: 455379.75, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'UNIQUE DRO AIRWEAR 1.59 XPERIO 2x1',                            lensIndex: '1.59', price: 1814751.12, cost: 455379.75, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'UNIQUE DRO STYLIS 1.67 2x1',                                    lensIndex: '1.67', price: 1306322.43, cost: 302583.75, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'UNIQUE DRO STYLIS 1.67 BLUE UV 2x1',                            lensIndex: '1.67', price: 1336387.22, cost: 311619,    laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'UNIQUE DRO STYLIS 1.67 TRANSITIONS GEN S 2x1',                  lensIndex: '1.67', price: 1877448.71, cost: 474222,    laboratory: 'OPTOVISION' },

  // ═══════════════════════════════════════════════════════════════
  //  KODAK — PRECISE (2x1 — Optovision)
  // ═══════════════════════════════════════════════════════════════
  { brand: 'Kodak', name: 'PRECISE ORMA BLUE UV 2x1',                                      lensIndex: '1.5',  price: 1072337.62, cost: 232265.25, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'PRECISE ORMA ACCLIMATES (Foto Gris) 2x1',                       lensIndex: '1.5',  price: 1306322.43, cost: 302583.75, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'PRECISE ORMA TRANSITIONS GEN S 2x1',                            lensIndex: '1.5',  price: 1618989.30, cost: 396548.25, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'PRECISE ORMA XPERIO 2x1',                                       lensIndex: '1.5',  price: 1618989.30, cost: 396548.25, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'PRECISE AIRWEAR 1.59 2x1',                                      lensIndex: '1.59', price: 1041591.52, cost: 223025.25, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'PRECISE AIRWEAR 1.59 BLUE UV 2x1',                              lensIndex: '1.59', price: 1072337.62, cost: 232265.25, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'PRECISE AIRWEAR 1.59 TRANSITIONS GEN S 2x1',                    lensIndex: '1.59', price: 1732068.57, cost: 430531.50, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'PRECISE AIRWEAR 1.59 XPERIO 2x1',                               lensIndex: '1.59', price: 1732068.57, cost: 430531.50, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'PRECISE STYLIS 1.67 2x1',                                        lensIndex: '1.67', price: 1227535.55, cost: 278906.25, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'PRECISE STYLIS 1.67 BLUE UV 2x1',                                lensIndex: '1.67', price: 1263539.93, cost: 289726.50, laboratory: 'OPTOVISION' },
  { brand: 'Kodak', name: 'PRECISE STYLIS 1.67 TRANSITIONS GEN S 2x1',                     lensIndex: '1.67', price: 1800600.92, cost: 451127.25, laboratory: 'OPTOVISION' },

  // ═══════════════════════════════════════════════════════════════
  //  VARILUX — COMFORT MAX + CRIZAL (2x1 — Optovision)
  // ═══════════════════════════════════════════════════════════════
  { brand: 'Varilux', name: 'COMFORT MAX - ORMA + CRIZAL 2x1',                                         lensIndex: '1.5',  price: 1455403.13, cost: 391125,    laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'COMFORT MAX - AIRWEAR 1.59 + CRIZAL 2x1',                                 lensIndex: '1.59', price: 1574607.79, cost: 430531.50, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'COMFORT MAX - STYLIS 1.67 + CRIZAL 2x1',                                  lensIndex: '1.67', price: 1642452.49, cost: 452959.50, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'COMFORT MAX - ORMA TRANSITIONS GEN S + CRIZAL 2x1',                       lensIndex: '1.59', price: 2014788.39, cost: 576045.75, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'COMFORT MAX - ORMA TRANSITIONS XTRACTIVE + CRIZAL 2x1',                   lensIndex: '1.59', price: 2014788.39, cost: 576045.75, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'COMFORT MAX - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL 2x1',               lensIndex: '1.59', price: 2134199.51, cost: 615520.50, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'COMFORT MAX - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL 2x1',                lensIndex: '1.67', price: 2203854.68, cost: 638547,    laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'COMFORT MAX - ORMA XPERIO + CRIZAL (Sol) 2x1',                            lensIndex: '1.59', price: 2014788.39, cost: 576045.75, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'COMFORT MAX - AIRWEAR 1.59 XPERIO + CRIZAL 2x1',                          lensIndex: '1.59', price: 2134199.51, cost: 615520.50, laboratory: 'OPTOVISION' },

  // ═══════════════════════════════════════════════════════════════
  //  VARILUX — PHYSIO 3.0 + CRIZAL (2x1 — Optovision)
  // ═══════════════════════════════════════════════════════════════
  { brand: 'Varilux', name: 'PHYSIO 3.0 - ORMA + CRIZAL 2x1',                                          lensIndex: '1.5',  price: 1723176.88, cost: 479645.25, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'PHYSIO 3.0 - AIRWEAR 1.59 + CRIZAL 2x1',                                  lensIndex: '1.59', price: 1836838.99, cost: 517219.50, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'PHYSIO 3.0 - STYLIS 1.67 + CRIZAL 2x1',                                   lensIndex: '1.67', price: 1902936.75, cost: 539070,    laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'PHYSIO 3.0 - ORMA TRANSITIONS GEN S + CRIZAL 2x1',                        lensIndex: '1.5',  price: 2280942.26, cost: 664030.50, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'PHYSIO 3.0 - ORMA TRANSITIONS XTRACTIVE + CRIZAL 2x1',                    lensIndex: '1.5',  price: 2280942.26, cost: 664030.50, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'PHYSIO 3.0 - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL 2x1',                lensIndex: '1.59', price: 2394397.91, cost: 701536.50, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'PHYSIO 3.0 - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL 2x1',                 lensIndex: '1.67', price: 2471580.79, cost: 727051.50, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'PHYSIO 3.0 - ORMA XPERIO + CRIZAL 2x1',                                   lensIndex: '1.5',  price: 2280942.26, cost: 664030.50, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'PHYSIO 3.0 - AIRWEAR 1.59 XPERIO + CRIZAL 2x1',                           lensIndex: '1.59', price: 2394397.91, cost: 701536.50, laboratory: 'OPTOVISION' },

  // ═══════════════════════════════════════════════════════════════
  //  VARILUX — XR DESIGN + CRIZAL (2x1 — Optovision)
  // ═══════════════════════════════════════════════════════════════
  { brand: 'Varilux', name: 'XR DESIGN - ORMA + CRIZAL 2x1',                                           lensIndex: '1.5',  price: 1830899.40, cost: 515256,    laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'XR DESIGN - AIRWEAR 1.59 + CRIZAL 2x1',                                   lensIndex: '1.59', price: 1948198.31, cost: 554032.50, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'XR DESIGN - STYLIS 1.67 + CRIZAL 2x1',                                    lensIndex: '1.67', price: 2023777.18, cost: 579017.25, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'XR DESIGN - ORMA TRANSITIONS GEN S + CRIZAL 2x1',                         lensIndex: '1.5',  price: 2412677.23, cost: 707579.25, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'XR DESIGN - AIRWEAR 1.59 TRANSITIONS GEN S + CRIZAL 2x1',                 lensIndex: '1.5',  price: 2537853.24, cost: 748959.75, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'XR DESIGN - STYLIS 1.67 TRANSITIONS GEN S + CRIZAL 2x1',                  lensIndex: '1.67', price: 2598090.83, cost: 768873,    laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'XR DESIGN - ORMA XPERIO + CRIZAL 2x1',                                    lensIndex: '1.5',  price: 2412677.23, cost: 707579.25, laboratory: 'OPTOVISION' },
  { brand: 'Varilux', name: 'XR DESIGN - AIRWEAR 1.59 XPERIO + CRIZAL 2x1',                            lensIndex: '1.59', price: 2537853.24, cost: 748959.75, laboratory: 'OPTOVISION' },
];

// ─── Seed runner ────────────────────────────────────────────────
async function seed() {
  console.log('🔬 Cargando cristales multifocales...\n');
  let ok = 0, skip = 0;

  for (const c of crystals) {
    try {
      await prisma.product.create({
        data: {
          name:       c.name,
          brand:      c.brand,
          category:   'Cristal',
          type:       'Cristal Multifocal',
          lensIndex:  c.lensIndex,
          unitType:   'PAR',
          laboratory: c.laboratory || 'OPTOVISION',
          price:      c.price,
          cost:       c.cost,
          stock:      0,
        },
      });
      ok++;
      console.log(`  ✅ ${c.brand} | ${c.name.substring(0, 60)} | $${c.price.toLocaleString('es-AR')}`);
    } catch (e) {
      skip++;
      console.log(`  ⚠️  Skip: ${c.name.substring(0, 50)}: ${e.message?.slice(0, 60)}`);
    }
  }

  console.log(`\n✨ Cargados: ${ok} | Saltados: ${skip} | Total: ${crystals.length}`);
  await prisma.$disconnect();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
