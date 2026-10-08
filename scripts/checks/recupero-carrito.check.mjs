#!/usr/bin/env node
/**
 * Reponer el carrito desde el mail de recupero (carritoRecuperable en
 * src/lib/checkout/recovery.ts), fijado.
 *
 * POR QUÉ EXISTE
 * Auditoría del 25/9/2026: el mail de recupero llevaba a /checkout pelado y el
 * carrito vive en el navegador. Abierto en otro dispositivo decía "Tu carrito
 * está vacío"; de 12 sesiones reales que recibieron el mail, 0 volvieron.
 * Reponerlo tiene reglas que no se ven desde afuera:
 *   · nunca se repone el carrito de alguien que YA compró (duplicaría el pedido);
 *   · el armazón vuelve con el precio de HOY, el mismo con el que cobra el
 *     checkout: un precio viejo más bajo rebota con "Discrepancia de precio";
 *   · los cristales elegidos se conservan;
 *   · el segundo par del 2x1 Varilux vuelve en $0, y lo agotado no vuelve;
 *   · no viaja ningún dato de la persona (el link se puede reenviar).
 *
 * Corre sin base y sin red (la base es un doble).
 * Uso: npm run check:recupero-carrito
 */

import { carritoRecuperable, esIdDeSesionValido, linkDeRecupero } from '../../src/lib/checkout/recovery.ts';

const casos = [];
const esperar = (nombre, cond, detalle) => casos.push({ nombre, ok: !!cond, detalle });

const ID = 'cmuhb8wue006y13o71crvabcd';
const carritoGuardado = [
    { id: 'l1', productId: 'p-armazon', brand: 'Cápsula Escarlata', model: 'Calipso Oval Negro', price: 160000 + 49500, basePrice: 160000, image: 'a.webp', lensColor: null, lensConfig: { lensType: 'MONOFOCAL', treatment: 'ORGANICO_AR' }, quantity: 1, email: 'no@deberia.viajar' },
    { id: 'l2', productId: 'p-sol', brand: 'Cápsula Escarlata', model: 'Zeus', price: 165000, image: 'z.webp', quantity: 2 },
    { id: 'l3', productId: 'p-borrado', brand: 'X', model: 'Ya no existe', price: 100000, quantity: 1 },
    { id: 'l4', productId: 'p-agotado', brand: 'X', model: 'Se vendió', price: 150000, quantity: 1 },
    { id: 'l5', productId: 'p-varilux-2', brand: 'X', model: 'Deneb — 2º par sin cargo (2x1 Varilux)', price: 0, basePrice: 0, wholesaleBasePrice: 0, lensConfig: { lensType: 'MULTIFOCAL', treatment: 'VARILUX', secondPair2x1: true }, quantity: 1 },
];
const productos = {
    'p-armazon': { id: 'p-armazon', price: 180000, salePrice: null, wholesalePrice: 0, stock: 3 }, // subió de 160k a 180k
    'p-sol': { id: 'p-sol', price: 215000, salePrice: 160000, wholesalePrice: 0, stock: 1 },     // ahora en oferta, queda 1
    'p-agotado': { id: 'p-agotado', category: 'Receta', price: 150000, salePrice: null, wholesalePrice: 0, stock: 0 },
    'p-varilux-2': { id: 'p-varilux-2', category: 'Receta', price: 170000, salePrice: null, wholesalePrice: 90000, stock: 2 },
};
function db(status) {
    return {
        checkoutSession: { findUnique: async () => (status === null ? null : { status, cartData: carritoGuardado }) },
        product: { findMany: async ({ where }) => where.id.in.map((id) => productos[id]).filter(Boolean) },
    };
}

esperar('el link lleva el id de la sesión', linkDeRecupero(ID).endsWith(`/checkout?recuperar=${ID}`), linkDeRecupero(ID));
esperar('un id con otra forma no se consulta', !esIdDeSesionValido("x' OR 1=1") && !esIdDeSesionValido('') && esIdDeSesionValido(ID));

{
    const items = await carritoRecuperable(ID, db('PENDING'));
    const armazon = items.find((i) => i.productId === 'p-armazon');
    const sol = items.find((i) => i.productId === 'p-sol');
    const segundoPar = items.find((i) => i.productId === 'p-varilux-2');
    esperar('repone lo que sigue existiendo y tiene stock', items.length === 3 && !items.some((i) => i.productId === 'p-agotado'), JSON.stringify(items.map((i) => i.productId)));
    esperar('el segundo par del 2x1 Varilux vuelve en $0 (como lo cobra el checkout)', segundoPar?.price === 0 && segundoPar?.basePrice === 0 && segundoPar?.wholesaleBasePrice === 0 && segundoPar?.lensConfig?.secondPair2x1 === true, JSON.stringify(segundoPar));
    esperar('el armazón vuelve con el precio de hoy', armazon?.basePrice === 180000, JSON.stringify(armazon));
    esperar('los cristales elegidos se conservan (precio y configuración)', armazon?.price === 180000 + 49500 && armazon?.lensConfig?.treatment === 'ORGANICO_AR', JSON.stringify(armazon));
    esperar('un producto que entró en oferta vuelve con la oferta', sol?.price === 160000, JSON.stringify(sol));
    esperar('la cantidad no pasa del stock que queda (pidió 2, queda 1)', sol?.quantity === 1, JSON.stringify(sol));
    esperar('no viaja ningún dato de la persona', items.every((i) => !('email' in i) && !('firstName' in i) && !('phone' in i)), JSON.stringify(items));
    esperar('trae el stock para el tope del "+"', armazon?.stock === 3);
}
esperar('también se repone si ya se mandó el mail (EMAIL_SENT)', (await carritoRecuperable(ID, db('EMAIL_SENT'))).length === 3);
for (const cerrado of ['COMPLETED', 'RECOVERED', 'FINALIZED', 'BOT']) {
    esperar(`${cerrado}: no se repone (ya compró o no es una persona)`, (await carritoRecuperable(ID, db(cerrado))).length === 0);
}
esperar('sesión inexistente: nada', (await carritoRecuperable(ID, db(null))).length === 0);

// El id viaja en el link del mail: la ruta pública de la sesión no puede
// devolver la fila (nombre, teléfono, email, dirección) a quien lo tenga.
{
    const { readFileSync } = await import('node:fs');
    const ruta = readFileSync(new URL('../../src/app/api/checkout/session/route.ts', import.meta.url), 'utf8');
    const put = ruta.slice(ruta.indexOf('export async function PUT'), ruta.indexOf('export async function GET'));
    esperar('el PUT público de la sesión no devuelve los datos de la persona', !/json\(\{[^}]*[{,]\s*session\s*[,}:]/.test(put) && /select:\s*\{\s*id:\s*true\s*\}/.test(put), put.match(/return NextResponse\.json\(\{ success[^\n]*/)?.[0]);
    esperar('el PUT público solo acepta los estados que se mandan de verdad', /ESTADOS_QUE_LLEGAN_DE_AFUERA/.test(put));
}

const fallas = casos.filter((c) => !c.ok);
for (const c of casos) console.log(`${c.ok ? '✅' : '❌'} ${c.nombre}${c.ok || !c.detalle ? '' : `\n     ${c.detalle}`}`);
console.log(`\n${casos.length - fallas.length}/${casos.length} casos OK`);
if (fallas.length) process.exit(1);
