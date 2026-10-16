#!/usr/bin/env node
/**
 * "Anteojo completo desde $X" (tarjeta de /tienda y ficha de receta), fijado.
 *
 * POR QUÉ EXISTE
 * La auditoría del 25/9/2026 midió que el 95,5% de la plata viene de ventas con
 * cristales y que la web mostraba solo el armazón: el precio de los cristales
 * aparecía recién adentro del configurador. El "desde" arregla eso, y tiene que
 * cumplir tres cosas que, si se rompen, no se ven desde el código:
 *
 *   · Es el MISMO número que da el configurador eligiendo ese cristal
 *     (calcularConfiguracion + preciosVidriera). Un "desde" más barato que lo
 *     que después cobra el checkout es una promesa falsa.
 *   · Si la base no respondió o el cristal no está disponible, NO se muestra.
 *     Nunca un precio de respaldo: eso fue el fotocromático a $791.435.
 *   · Solo en Receta y fuera del canal mayorista (sol y clip-on no llevan
 *     cristales con receta desde la ficha).
 *
 * Corre sin base y sin red.
 * Uso: npm run check:anteojo-completo
 */

import { anteojoCompletoDesde, configCristalBase } from '../../src/lib/anteojo-completo.ts';
import { CRISTAL_BASE_ANTEOJO_COMPLETO } from '../../src/lib/constants/anteojo-completo.ts';
import { calcularConfiguracion } from '../../src/lib/cristales-web/calculo.ts';
import { claveDeCristal, CLAVES_OPCION } from '../../src/lib/cristales-web/claves.ts';
import { PricingService } from '../../src/services/PricingService.ts';

const casos = [];
const ok = (nombre) => casos.push({ nombre, ok: true });
const falla = (nombre, detalle) => casos.push({ nombre, ok: false, detalle });
const esperar = (nombre, cond, detalle) => (cond ? ok(nombre) : falla(nombre, detalle));

function opcion(clave, precio, extra = {}) {
    const [grupo, codigo] = clave.split('.');
    return {
        clave, grupo, codigo, etiqueta: 'Antirreflex (Evita Brillos)', descripcion: null, badge: null,
        destacados: [], orden: 10, disponible: true, motivo: null, precio, nombreProducto: 'Stock · Orgánico Blanco c/AR 1.56',
        is2x1: false, productId: 'p-ar', ...extra,
    };
}

const base = CRISTAL_BASE_ANTEOJO_COMPLETO;
const opciones = { [base]: opcion(base, 49500) };
const armazon = { price: 160000, salePrice: null };
const args = (extra = {}) => ({ producto: armazon, categoriaWeb: 'Receta', esMayorista: false, opciones, descuentoTransferenciaPct: 15, ...extra });

// 1. La constante es una opción real del configurador y su config vuelve a la misma clave.
esperar('el cristal base es una opción del configurador', CLAVES_OPCION.includes(base), base);
esperar('la configuración del cristal base apunta a esa opción', claveDeCristal(configCristalBase()).clave === base,
    JSON.stringify(configCristalBase()));

// 2. Mismo número que el configurador (calcularConfiguracion) y que la vidriera (preciosVidriera).
{
    const d = anteojoCompletoDesde(args());
    const conf = calcularConfiguracion({ basePrice: 160000, lensConfig: configCristalBase(), opciones });
    const vid = PricingService.preciosVidriera(conf.ok ? conf.total : -1, 15);
    esperar('lista = total del configurador', d?.lista === 209500 && conf.ok && d.lista === conf.total, JSON.stringify({ d, conf }));
    esperar('transferencia = preciosVidriera().contado', d?.transferencia === vid.contado && vid.contado === 178075, JSON.stringify({ d, vid }));
    esperar('dice qué cristal incluye', d?.cristal === 'Monofocal · Antirreflex (Evita Brillos)', d?.cristal);
}

// 3. Con oferta, el armazón entra al precio que se cobra, no al de lista.
{
    const d = anteojoCompletoDesde(args({ producto: { price: 215000, salePrice: 160000 } }));
    esperar('con oferta usa el precio de oferta', d?.lista === 209500, JSON.stringify(d));
    const sinRebaja = anteojoCompletoDesde(args({ producto: { price: 160000, salePrice: 180000 } }));
    esperar('un salePrice mayor al de lista no es oferta', sinRebaja?.lista === 209500, JSON.stringify(sinRebaja));
}

// 4. Sin precio real, no se muestra nada.
esperar('sin opciones (la base no respondió) → oculto', anteojoCompletoDesde(args({ opciones: null })) === null);
esperar('opción sin producto vinculado → oculto',
    anteojoCompletoDesde(args({ opciones: { [base]: opcion(base, null, { disponible: false, motivo: 'SIN_PRODUCTO', productId: null }) } })) === null);
esperar('opción desactivada → oculto',
    anteojoCompletoDesde(args({ opciones: { [base]: opcion(base, 49500, { disponible: false, motivo: 'INACTIVA' }) } })) === null);
esperar('opciones sin el cristal base → oculto', anteojoCompletoDesde(args({ opciones: {} })) === null);
esperar('armazón sin precio → oculto', anteojoCompletoDesde(args({ producto: { price: 0 } })) === null);

// 5. Solo Receta, y nunca en el canal mayorista.
for (const cat of ['Sol', 'Clip-On', 'Cristal', '', null, undefined]) {
    esperar(`categoría ${JSON.stringify(cat)} → oculto`, anteojoCompletoDesde(args({ categoriaWeb: cat })) === null);
}
esperar('mayorista → oculto', anteojoCompletoDesde(args({ esMayorista: true })) === null);

const fallas = casos.filter((c) => !c.ok);
for (const c of casos) console.log(`${c.ok ? '✅' : '❌'} ${c.nombre}${c.ok ? '' : `\n     ${c.detalle ?? ''}`}`);
console.log(`\n${casos.length - fallas.length}/${casos.length} casos OK`);
if (fallas.length) process.exit(1);
