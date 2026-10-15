// ────────────────────────────────────────────────────────────────────────────
// QUÉ PRODUCTO MIRABA quien escribió desde la tienda (plan 15/10/2026, 3.7).
//
// El origen "Tienda online" se asignaba solo pero no decía qué miró la
// persona. El dato viaja en el primer mensaje (los botones de la ficha y el
// link pegado al final) y src/lib/producto-mirado-web.ts lo lee de vuelta
// para la ficha y para Oportunidades de Cierre. Si alguien cambia el texto de
// un botón de la ficha sin tocar el helper, esto falla.
//
// Puro: sin base y sin red.
// Correr:  npm run check:producto-mirado
// ────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { productoMiradoEnMensaje, productoMiradoEnMensajes, etiquetaMiraba } from '../../src/lib/producto-mirado-web.ts';
import { mensajeDelBotonFlotante } from '../../src/lib/whatsapp-mensaje-flotante.ts';

let ok = 0;
const fallas = [];
const check = (nombre, cond, extra = '') => {
    if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
    else { fallas.push(nombre); console.log(`  ✗ ${nombre} ${extra}`); }
};
const p = (t) => productoMiradoEnMensaje(t);

console.log('\nLos mensajes que arma el sitio');
const flotante = mensajeDelBotonFlotante({ pathname: '/producto/victoria-c7', productName: 'Victoria C7' }).texto;
check('el botón flotante de la ficha → "Victoria C7"', p(flotante)?.nombre === 'Victoria C7', JSON.stringify(p(flotante)));
check('con el link de la ficha pegado abajo trae el slug', JSON.stringify(p(`${flotante}\n\nhttps://atelieroptica.com.ar/producto/victoria-c7`)) === JSON.stringify({ nombre: 'Victoria C7', slug: 'victoria-c7' }));
const mayorista = mensajeDelBotonFlotante({ pathname: '/producto/zeus', productName: 'Zeus C33', isOptica: true }).texto;
check('la consulta mayorista → "Zeus C33" (sin el paréntesis de Cápsula Escarlata)', p(mayorista)?.nombre === 'Zeus C33', JSON.stringify(p(mayorista)));
check('"Quiero comprar el anteojo Atelier Victoria C7 — $145.000 por transferencia…" → corta en el guion', p('¡Hola! Quiero comprar el anteojo Atelier Victoria C7 — $145.000 por transferencia, 6 cuotas sin interés de $24.167 o 12 cuotas fijas de $13.292. ¿Me pasarían los datos de pago?')?.nombre === 'Atelier Victoria C7');
check('"Quiero consultar las medidas del anteojo Atelier Mizar C2." → sin el punto', p('¡Hola! Quiero consultar las medidas del anteojo Atelier Mizar C2.')?.nombre === 'Atelier Mizar C2');
check('solo el link (borró el texto) → nombre legible desde el slug', JSON.stringify(p('https://atelieroptica.com.ar/producto/apolo-c2')) === JSON.stringify({ nombre: 'apolo c2', slug: 'apolo-c2' }));

console.log('\nLo que NO es un producto');
check('"Estoy recorriendo la tienda online…" no nombra ninguno', p('¡Hola Atelier! Estoy recorriendo la tienda online y me gustaría recibir asesoramiento.') === null);
check('un mensaje cualquiera', p('Hola, ¿tienen multifocales?') === null);
check('vacío / null', p('') === null && p(null) === null);

console.log('\nVarios mensajes y la etiqueta');
check('toma el primero que nombra algo', productoMiradoEnMensajes(['hola', flotante, 'Quiero comprar el anteojo Otro'])?.nombre === 'Victoria C7');
check('etiqueta para la tarjeta: "miraba Victoria C7"', etiquetaMiraba({ nombre: 'Victoria C7' }) === 'miraba Victoria C7' && etiquetaMiraba(null) === '');

console.log('\nDónde se muestra');
const cierres = readFileSync(new URL('../../src/services/cierres.service.ts', import.meta.url), 'utf8');
check('Oportunidades de Cierre suma "miraba X" al detalle de la tarjeta', cierres.includes('productoMiradoPorCliente(') && cierres.includes('etiquetaMiraba(p)'));
const contacto = readFileSync(new URL('../../src/services/contact.service.ts', import.meta.url), 'utf8');
check("la ficha (getById) devuelve productoWeb", contacto.includes("productoWeb"));
const banner = readFileSync(new URL('../../src/components/contacts/ContactOrigin.tsx', import.meta.url), 'utf8');
check('el banner de origen de la ficha lo muestra como chip', banner.includes('contact.productoWeb && <MirabaChip'));

console.log(`\n${ok} ok, ${fallas.length} fallas`);
if (fallas.length) { console.log('FALLAS:', fallas.join(' · ')); process.exit(1); }
