// ────────────────────────────────────────────────────────────────────────────
// Saca el código de fábrica de los textos que ve el cliente.
//
// El código interno (Q8013-C3, 8125S C3, G5929…) quedó escrito adentro de la
// prosa de venta: "…el modelo Q8013-C3 destaca por su cuerpo pulido a mano…".
// Aparece en tres campos: la descripción de la ficha, la descripción SEO (lo
// que Google muestra abajo del link) y el título SEO (la pestaña del navegador).
//
// NO reescribe la prosa: hace un reemplazo quirúrgico y deja el resto intacto.
//   · "el modelo <CÓDIGO>"  →  "el modelo <Nombre Color>"    ("el modelo Frida C3")
//   · cualquier otro <CÓDIGO>  →  el color solo               ("Torino 8125S C3" → "Torino C3")
//   · el código sin color      →  se borra
// Después colapsa colores repetidos y limpia espacios de más.
//
// Las URLs (slug) NO se tocan: cambiarlas rompe links ya indexados.
//
// Uso:
//   DRY_RUN=1 AUDIT_DB_URL="$PROD_DATABASE_URL" node <este archivo>   → simula
//            AUDIT_DB_URL="$PROD_DATABASE_URL" node <este archivo>   → escribe
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';

const url = process.env.AUDIT_DB_URL || process.env.DATABASE_URL;
const DRY = !!process.env.DRY_RUN;
const prisma = new PrismaClient({ datasources: { db: { url } } });
const soloId = { select: { id: true } };

// Títulos que el reemplazo automático dejaría raros ("Modelo C3", "Armazón de
// Receta C6"). Son dos, se escriben a mano.
const TITULOS_A_MANO = {
  '8005S C3': 'Lentes de Sol Clip-On Palermo C3 | Estilo y Protección UV - Atelier Óptica',
  '91501 C6': 'Athena C6 | Armazón de Receta - Calidad Premium',
};

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// El código sin el sufijo de color: "Q8013-C3" → "Q8013", "8125S C3" → "8125S"
const codigoBase = (modelo) => modelo.replace(/[\s-]*C\d+(-\d+)?$/i, '').trim();
// El color que lleva el nombre nuevo: "Frida C3" → "C3"
const colorDe = (nombre) => (nombre.match(/\bC\d+(-\d+)?$/i) || [''])[0];

function limpiar(texto, { modelo, nombre }) {
  if (!texto) return texto;
  const base = codigoBase(modelo);
  const color = colorDe(nombre);
  let out = texto;

  // 1) "el modelo <CÓDIGO>" → "el modelo <Nombre Color>". Es la forma en la que
  //    aparece en el 90% de las descripciones y queda natural.
  out = out.replace(new RegExp(`(\\bel modelo )${escapar(modelo)}\\b`, 'gi'), `$1${nombre}`);

  // 2) El código completo en cualquier otro lado → solo el color.
  out = out.replace(new RegExp(`\\s*${escapar(modelo)}\\b`, 'gi'), color ? ` ${color}` : '');

  // 3) El código sin color suelto (ej: "Capri C5 G5929") → se borra.
  if (base.length >= 4 && base !== modelo) {
    out = out.replace(new RegExp(`\\s*\\b${escapar(base)}\\b`, 'g'), '');
  }

  // 4) Restos: "Atelier Athena" / "Atelier Gaia" quedaron con el prefijo viejo.
  out = out.replace(/\bAtelier (Athena|Gaia)\b/g, '$1');

  // 5) Color duplicado ("Capri C5 C5") y espacios de más.
  out = out.replace(/\b(C\d+(?:-\d+)?)(\s+\1)+\b/gi, '$1');
  out = out.replace(/[ \t]{2,}/g, ' ').replace(/ +([.,;:!?])/g, '$1').replace(/ +\|/g, ' |');
  return out.trim();
}

const main = async () => {
  const rows = await prisma.webProduct.findMany({
    where: { isActive: true },
    select: {
      id: true, name: true, slug: true, description: true,
      product: { select: { id: true, model: true, seoTitle: true, seoDescription: true } },
    },
    orderBy: { name: 'asc' },
  });

  const reversa = [];
  let tocados = 0;
  const out = `scripts/maintenance/reversa-codigos-textos-${process.env.STAMP || 'sin-fecha'}.json`;

  try {
    for (const wp of rows) {
      const p = wp.product;
      const modelo = (p.model || '').trim();
      if (!modelo || modelo.length < 3) continue;
      const ctx = { modelo, nombre: wp.name };

      const nuevaDesc = limpiar(wp.description, ctx);
      const nuevaSeoDesc = limpiar(p.seoDescription, ctx);
      const nuevoTitulo = TITULOS_A_MANO[modelo] ?? limpiar(p.seoTitle, ctx);

      const cambios = [];
      if (nuevaDesc !== wp.description) cambios.push(['descripción', wp.description, nuevaDesc]);
      if (nuevaSeoDesc !== p.seoDescription) cambios.push(['desc. SEO', p.seoDescription, nuevaSeoDesc]);
      if (nuevoTitulo !== p.seoTitle) cambios.push(['título SEO', p.seoTitle, nuevoTitulo]);
      if (!cambios.length) continue;

      tocados++;
      console.log(`\n── ${wp.name}  (${modelo})`);
      for (const [campo, antes, despues] of cambios) {
        const rec = (t) => {
          const plano = (t || '').replace(/\s+/g, ' ');
          return process.env.FULL ? plano : plano.slice(0, 150);
        };
        console.log(`   ${campo}`);
        console.log(`     antes:   ${rec(antes)}`);
        console.log(`     después: ${rec(despues)}`);
      }

      reversa.push({
        webProductId: wp.id, productId: p.id, slug: wp.slug, modelo,
        antes: { description: wp.description, seoDescription: p.seoDescription, seoTitle: p.seoTitle },
        despues: { description: nuevaDesc, seoDescription: nuevaSeoDesc, seoTitle: nuevoTitulo },
      });

      if (!DRY) {
        if (nuevaDesc !== wp.description) {
          await prisma.webProduct.update({ where: { id: wp.id }, data: { description: nuevaDesc }, ...soloId });
        }
        if (nuevaSeoDesc !== p.seoDescription || nuevoTitulo !== p.seoTitle) {
          await prisma.product.update({
            where: { id: p.id },
            data: { seoDescription: nuevaSeoDesc, seoTitle: nuevoTitulo },
            ...soloId,
          });
        }
      }
    }
  } finally {
    if (!DRY && reversa.length) writeFileSync(out, JSON.stringify(reversa, null, 2));
  }

  console.log(`\n${DRY ? '=== SIMULACRO, no se escribió nada ===' : '=== APLICADO ==='}`);
  console.log(`Productos con texto corregido: ${tocados}`);
  if (!DRY && reversa.length) console.log(`Reversa en ${out}`);
};

main().finally(() => prisma.$disconnect());
