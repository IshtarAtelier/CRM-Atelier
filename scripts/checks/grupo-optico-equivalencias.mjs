/**
 * ¿TODOS los cristales de Grupo Óptico del catálogo resuelven a UN artículo
 * del portal de SmartLab? SOLO LECTURA: lee los productos de la base que diga
 * DATABASE_URL (la copia local de producción, nunca la de prod sin OK) y, con
 * `--portal`, consulta las listas del portal con GET (las mismas que usa el
 * robot al preparar: material, color, marca, artículo). No crea nada.
 *
 *   DATABASE_URL=…/atelier_prodcopia node --experimental-strip-types --import ./scripts/checks/_alias.mjs \
 *     scripts/checks/grupo-optico-equivalencias.mjs [--portal] [--solo=texto]
 *
 * Con `--portal` hacen falta SMARTLAB_USER / SMARTLAB_PASSWORD / SMARTLAB_CLIENT_ID
 * en el entorno (railway variables --kv desde la carpeta `atelier`); nunca se
 * imprimen. Cada lista del portal se pide UNA vez (caché por consulta).
 *
 * Por qué existe: el 3/10/2026 la tabla de equivalencias (catalogo.ts)
 * resolvía 312 de 324 productos y el 10/10 quedaban 8 sin equivalencia. Esto
 * lo mide de nuevo cada vez, producto por producto, con la regla REAL del
 * robot (especificacionDe + elegirArticulo), y no de memoria.
 */
import { PrismaClient } from '@prisma/client';
import { especificacionDe, elegirArticulo, colorDelItem } from '../../src/services/lab-modules/grupo-optico/catalogo.ts';
import { paletaDeGrupoOptico } from '../../src/lib/constants/paletas-color.ts';

const args = process.argv.slice(2);
const conPortal = args.includes('--portal');
const solo = (args.find(a => a.startsWith('--solo=')) || '').slice(7).toLowerCase();
const url = process.env.DATABASE_URL || '';
if (!/localhost|127\.0\.0\.1/.test(url)) { console.error('Este check lee productos SOLO de una base local (DATABASE_URL con localhost).'); process.exit(2); }

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const prisma = new PrismaClient();
const productos = (await prisma.product.findMany({
    where: { category: 'Cristal', laboratory: { contains: 'grupo', mode: 'insensitive' } },
    select: { id: true, name: true, type: true, price: true },
    orderBy: { name: 'asc' },
})).filter(p => !solo || normalizar(p.name).includes(solo));
await prisma.$disconnect();

// 1) En seco: nombre → especificación (familia, material, color, Essential).
const filas = productos.map(p => {
    const paleta = paletaDeGrupoOptico(normalizar(p.name));
    const colorItem = paleta?.tonos?.[0]?.name ?? null; // el primer tono que el vendedor podría elegir
    const r = especificacionDe(p.name, { colorItem });
    return { ...p, colorItem, paleta: paleta ? paleta.tonos.map(t => t.name).join('/') : null, esp: r.ok ? r.especificacion : null, motivo: r.ok ? null : r.motivo };
});
const sinEsp = filas.filter(f => !f.esp);
console.log(`Cristales de Grupo Óptico en la base: ${filas.length} · con especificación: ${filas.length - sinEsp.length} · sin equivalencia declarada: ${sinEsp.length}`);
for (const f of sinEsp) console.log(`  ❌ ${f.name}\n     ${f.motivo}`);

if (!conPortal) {
    console.log('\n(sin --portal: no se consultaron las listas del portal; lo de arriba es solo la tabla de equivalencias)');
    process.exit(sinEsp.length ? 1 : 0);
}

// 2) Contra el portal: las mismas listas que pide el robot, una vez cada una.
const { conSesionSmartLab, API_BASE, clientIdSmartLab, pedirJsonDesdeLaPagina } = await import('../../src/services/lab-modules/grupo-optico/portal.ts');
const q = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
const resultados = [];
await conSesionSmartLab(async (page) => {
    const cache = new Map();
    const lista = async (ruta) => {
        if (!cache.has(ruta)) {
            const r = await pedirJsonDesdeLaPagina(page, `${API_BASE}${ruta}`);
            cache.set(ruta, Array.isArray(r) ? r : []);
            await page.waitForTimeout(300);
        }
        return cache.get(ruta);
    };
    const clientId = clientIdSmartLab();
    for (const f of filas) {
        if (!f.esp) { resultados.push({ ...f, ok: false, detalle: f.motivo }); continue; }
        const esp = f.esp;
        const stock = esp.clase === 'STOCK';
        const lensTypeId = stock ? '1' : String(esp.familia.lensTypeId);
        const multifocal = lensTypeId !== '1';
        try {
            const materiales = await lista(`/data/material/list?${q({ current: 1, rowCount: 100000, lensTypeId, artODStock: stock ? 1 : 0 })}`);
            const materialId = esp.material.materialId;
            const mat = materiales.find(m => String(m.value) === String(materialId));
            if (!mat) throw new Error(`el portal no ofrece el material ${esp.material.etiqueta} (id ${materialId}) para tipo ${lensTypeId}${stock ? ' de stock' : ''}`);
            if (mat.label.trim().toUpperCase() !== esp.material.etiqueta.toUpperCase()) throw new Error(`el material ${materialId} del portal dice "${mat.label}", la tabla espera "${esp.material.etiqueta}"`);
            const colorId = stock ? 1 : esp.colorId;
            if (!stock) {
                const colores = await lista(`/data/color/list?${q({ current: 1, rowCount: 100000, lensTypeId, materialId })}`);
                if (!colores.find(c => String(c.value) === String(colorId))) throw new Error(`el material ${mat.label} no viene en el color ${colorId} (ofrece: ${colores.map(c => c.label).join(', ')})`);
            }
            const marcas = await lista(`/data/brand/list?${q({ current: 1, rowCount: 100000, lensTypeId, materialId, colorId, rightEyeStockArticle: stock ? 1 : 0, clientId, isAdmin: 0 })}`);
            const brandId = stock ? Number(marcas.length === 1 ? marcas[0].value : NaN) : esp.familia.brandId;
            const marca = marcas.find(b => String(b.value) === String(brandId));
            if (!marca) throw new Error(`la marca no cierra (ofrece: ${marcas.map(m => m.label).join(', ') || 'ninguna'})`);
            // Una graduación común para ver la lista de artículos (multifocal: la de cerca).
            // Rango extendido: una graduación alta, que es cuando el portal ofrece el
            // artículo R.EXT; cada línea de stock tiene su rango, así que se prueban varias.
            const esfericos = stock && esp.rangoExtendido ? ['-7.00', '-5.00', '-4.00', '-3.00', '+4.00'] : [multifocal ? '+1.00' : '-1.00'];
            let arts = [];
            for (const esferico of esfericos) {
                const consulta = { lensTypeId, isStock: stock ? 1 : 0, materialId: stock ? esp.material.codigoArticulos : materialId, colorId, brandId, spherical: esferico, cylindrical: '-0.50', clientId, isAdmin: 0 };
                arts = await lista(`/data/article/list?${q(consulta)}`);
                if (arts.some(a => /R\. ?EXT/i.test(a.label)) || !esp.rangoExtendido) break;
            }
            const r = elegirArticulo(arts, esp);
            if (!r.ok) throw new Error(r.motivo);
            resultados.push({ ...f, ok: true, detalle: `${mat.label} · ${marca.label} · ${r.articulo.label}` });
        } catch (err) {
            resultados.push({ ...f, ok: false, detalle: err?.message || String(err) });
        }
    }
});

const malos = resultados.filter(r => !r.ok);
console.log(`\nContra el portal: ${resultados.length - malos.length} resuelven a UN artículo · ${malos.length} no`);
for (const r of resultados.filter(r => r.ok)) console.log(`  ✅ ${r.name}${r.paleta ? ` [color: ${r.colorItem} de ${r.paleta}]` : ''}\n     → ${r.detalle}`);
for (const r of malos) console.log(`  ❌ ${r.name}\n     ${r.detalle}`);
process.exit(malos.length ? 1 : 0);
