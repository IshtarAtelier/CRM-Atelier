/**
 * Chequeo de la comparación de referencias de comprobantes.
 *
 * Caso que lo motivó (28/7/2026): el comprobante de Mercado Pago de Veronica
 * Serlin traía "Número de operación 170029330395" Y "Código de identificación
 * 76V4MR2Z87VYP0WE9DEZOL". La vendedora cargó el número de operación —bien— y el
 * sistema, que solo miraba UN identificador, le mandó un mail firmado por Ishtar
 * diciéndole que estaba mal y le pisó la referencia buena.
 *
 * Correr: npm run check:comprobantes
 */
import {
    collectReferenceIds,
    crossCheckReadings,
    looksLikeSeparatorArtifact,
    mergeIds,
    parseReceiptAmount,
    referencesMatch,
    sameVoucherNumber,
    stripTxTags,
    strongIds
} from '../../src/lib/receipt-references.ts';
import { cardVoucherKey, describeCardVoucher, isCardMethod } from '../../src/lib/payment-card.ts';

let fallos = 0;
function check(nombre, condicion) {
    if (condicion) {
        console.log(`  ✓ ${nombre}`);
    } else {
        fallos++;
        console.error(`  ✗ ${nombre}`);
    }
}

const OPERACION = '170029330395';
const IDENTIFICACION = '76V4MR2Z87VYP0WE9DEZOL';
/** Lectura vacía: los tests le pisan solo lo que les importa. */
const SIN_CUPON = { amount: null, amountRaw: null, cuit: null, date: null, dateRaw: null, ids: [], batchNumber: null, couponNumber: null, authNumber: null };

console.log('\nCaso Veronica Serlin (Mercado Pago con dos identificadores)');
{
    const lectura = collectReferenceIds({
        transaction_id: OPERACION,
        reference_ids: [OPERACION, IDENTIFICACION]
    });
    check('se listan los dos identificadores, sin repetir', lectura.length === 2);
    check('la referencia cargada (nº de operación) coincide', lectura.some(id => referencesMatch(OPERACION, id)));
    check('el código de identificación también coincide si lo tipean a él', lectura.some(id => referencesMatch(IDENTIFICACION, id)));
    check('una referencia inventada NO coincide', !lectura.some(id => referencesMatch('999888777666', id)));
}

console.log('\nTolerancia de formato y de OCR');
check('con puntos y espacios es el mismo número', referencesMatch('170.029.330 395', OPERACION));
check('minúsculas y guiones son el mismo código', referencesMatch('76v4mr2z87-vyp0we9dezol', IDENTIFICACION));
check('la O y el cero confundidos no son un error', referencesMatch('76V4MR2Z87VYPOWE9DEZOL', IDENTIFICACION));
check('un número parecido pero distinto NO coincide', !referencesMatch('170029330396', OPERACION));
check('referencia corta no matchea por contención', !referencesMatch('395', OPERACION));

console.log('\nDescarte de basura en la lectura');
{
    const ids = collectReferenceIds({ transaction_id: 'AR', reference_ids: ['1', '', null, 12345, '  1700293  '] });
    check('se descartan cadenas de menos de 3 caracteres y lo que no es texto', ids.length === 1 && ids[0] === '1700293');
}

console.log('\nCruce de las dos lecturas OCR');
{
    const a = { ...SIN_CUPON, amount: 166774, cuit: '30716850090', dateRaw: '28/07/26', date: '2026-07-28', ids: [OPERACION] };
    const b = { ...SIN_CUPON, amount: 166774, cuit: '30-71685009-0', dateRaw: '28/07/26', date: '2026-07-28', ids: [IDENTIFICACION] };
    const r = crossCheckReadings(a, b);
    check('coincidiendo, el monto queda habilitado para auditar', r.values.amount === 166774);
    check('el CUIT con y sin guiones es el mismo', r.values.cuit === '30716850090');
    check('la fecha queda habilitada', r.values.date === '2026-07-28');
    check('los identificadores de las dos lecturas se unen', r.values.ids.length === 2);
    check('sin desacuerdos', r.disagreements.length === 0);
    check('las dos lecturas listaron identificadores', r.bothListedIds === true);
}
{
    const a = { ...SIN_CUPON, amount: 166774, cuit: null, dateRaw: '28/07/26', date: '2026-07-28', ids: [OPERACION] };
    const b = { ...SIN_CUPON, amount: 16677, cuit: null, dateRaw: '21/07/26', date: '2026-07-21', ids: [OPERACION] };
    const r = crossCheckReadings(a, b);
    check('montos distintos → NO se audita el monto', r.values.amount === null);
    check('fechas distintas → NO se audita la fecha', r.values.dateRaw === null && r.values.date === null);
    check('los desacuerdos quedan anotados para el admin', r.disagreements.length === 2);
}
{
    const a = { ...SIN_CUPON, amount: 166774, cuit: '30716850090', date: '2026-07-28', ids: [OPERACION] };
    const r = crossCheckReadings(a, null);
    check('si el segundo lector falla, no se audita nada', r.values.amount === null && r.values.cuit === null && r.values.date === null);
    check('y no se puede reclamar una referencia', r.bothListedIds === false);
    check('pero los identificadores siguen sirviendo para detectar duplicados', r.values.ids.length === 1);
}
{
    const a = { ...SIN_CUPON, ids: [OPERACION] };
    const b = { ...SIN_CUPON, ids: [] };
    const r = crossCheckReadings(a, b);
    check('si un lector no vio ningún identificador, no se reclama la referencia', r.bothListedIds === false);
}

console.log('\nUnión de identificadores');
check('no se duplica el mismo id escrito distinto', mergeIds([OPERACION], ['170.029.330.395']).length === 1);

console.log('\nTicket de posnet (Payway presencial)');
{
    // Ticket real: Lote 011, Cupón 0172, Autorización 007956.
    const a = { ...SIN_CUPON, amount: 836250, ids: ['011', '0172', '007956'], batchNumber: '011', couponNumber: '0172', authNumber: '007956' };
    const b = { ...SIN_CUPON, amount: 836250, ids: ['011', '0172', '007956'], batchNumber: '11', couponNumber: '0172', authNumber: '7956' };
    const r = crossCheckReadings(a, b);
    check('el nº de lote sobrevive aunque un lector le coma los ceros', r.values.batchNumber === '011');
    check('el nº de cupón queda habilitado', r.values.couponNumber === '0172');
    check('el nº de autorización queda habilitado', r.values.authNumber === '007956');
    check('sin desacuerdos por los ceros a la izquierda', r.disagreements.length === 0);

    const ids = collectReferenceIds({ transaction_id: '0172', reference_ids: ['011', '0172', '007956'] });
    check('los números cortos del ticket NO se descartan', ids.length === 3);
    check('el cupón tipeado por el vendedor coincide', ids.some(id => referencesMatch('0172', id)));
    check('ninguno sirve solo para buscar duplicados', strongIds(ids).length === 0);
}
{
    const c = { ...SIN_CUPON, batchNumber: '011', couponNumber: '0172', authNumber: '007956' };
    const d = { ...SIN_CUPON, batchNumber: '011', couponNumber: '0173', authNumber: '007957' };
    check('el trío lote+cupón+autorización sí es clave de duplicado', cardVoucherKey(c) !== null);
    check('dos cupones distintos dan claves distintas', cardVoucherKey(c) !== cardVoucherKey(d));
    check('los ceros a la izquierda no cambian la clave', cardVoucherKey(c) === cardVoucherKey({ batchNumber: '11', couponNumber: '172', authNumber: '7956' }));
    check('con un solo dato no hay clave', cardVoucherKey({ couponNumber: '0172' }) === null);
    check('se describe legible', describeCardVoucher(c) === 'Lote 011 · Cupón 0172 · Aut. 007956');
}
{
    check('un nº de lote igual NO es el mismo número que otro distinto', !sameVoucherNumber('011', '012'));
    check('011 y 11 son el mismo lote', sameVoucherNumber('011', '11'));
    check('un campo vacío nunca coincide', !sameVoucherNumber('', '011'));
    check('Pay Way es método con tarjeta', isCardMethod('PAY_WAY_6_YANI'));
    check('una transferencia no lo es', !isCardMethod('TRANSFERENCIA_ISHTAR'));
}

console.log('\nNotas: la referencia de la persona se conserva');
check('las etiquetas [TX: ...] no se muestran', stripTxTags('170029330395 [TX: 170029330395] [TX: POS-11-172-7956]') === '170029330395');
check('una nota sin etiquetas queda igual', stripTxTags('Pago dividido') === 'Pago dividido');
check('solo etiquetas → vacío', stripTxTags('[TX: 170029330395]') === '');

console.log('\nIdentificadores fuertes (para duplicados)');
check('un nº de operación largo sirve', strongIds([OPERACION, IDENTIFICACION]).length === 2);
check('un nº de autorización de 6 dígitos no', strongIds(['007956']).length === 0);

console.log('\nFecha impresa (blindaje del falso positivo de "comprobante viejo")');
{
    const a = { ...SIN_CUPON, dateRaw: '17/07/26', date: '2026-07-17', ids: [OPERACION] };
    const b = { ...SIN_CUPON, dateRaw: '17-07-26', date: '2026-07-17', ids: [OPERACION] };
    const r = crossCheckReadings(a, b);
    check('la fecha impresa pasa aunque cambien los separadores', r.values.dateRaw === '17/07/26');
    check('sin desacuerdos por el guión', r.disagreements.length === 0);
}
{
    const a = { ...SIN_CUPON, dateRaw: '17/07/26', ids: [OPERACION] };
    const b = { ...SIN_CUPON, dateRaw: '11/07/26', ids: [OPERACION] };
    const r = crossCheckReadings(a, b);
    check('fechas impresas distintas → NO se audita la fecha', r.values.dateRaw === null);
    check('y queda anotado para el admin', r.disagreements.length === 1);
}

console.log('\nImporte impreso (blindaje del falso positivo de "Monto difiere")');
{
    // Casos reales del 31/7/2026: dos comprobantes distintos, el mismo error.
    // Ualá por $318.500 se leyó "318.5"; Galicia por $540.610 se leyó "540.61".
    check('el punto de miles argentino NO es coma decimal', parseReceiptAmount('318.500') === 318500);
    check('Galicia $540.610 son quinientos cuarenta mil seiscientos diez', parseReceiptAmount('540.610') === 540610);
    check('y contra los $540.610 cargados no hay ninguna diferencia', Math.abs(parseReceiptAmount('540.610') - 540610) === 0);
    check('540,61 contra 540.610 es un separador mal leído', looksLikeSeparatorArtifact(540.61, 540610));
    check('con el signo pesos y espacios también', parseReceiptAmount('$ 318.500') === 318500);
    check('dos puntos de miles', parseReceiptAmount('1.234.567') === 1234567);
    check('miles con punto y centavos con coma', parseReceiptAmount('1.234,56') === 1234.56);
    check('formato yanqui: miles con coma y centavos con punto', parseReceiptAmount('1,234.56') === 1234.56);
    check('coma seguida de tres dígitos también es de miles', parseReceiptAmount('318,500') === 318500);
    check('dos dígitos detrás sí son centavos', parseReceiptAmount('318,50') === 318.5);
    check('un solo dígito detrás también', parseReceiptAmount('1.5') === 1.5);
    check('sin separadores queda igual', parseReceiptAmount('318500') === 318500);
    check('un número ya parseado pasa tal cual', parseReceiptAmount(318500) === 318500);
    check('lo ilegible es null', parseReceiptAmount('n/d') === null && parseReceiptAmount(null) === null);
}
{
    const a = { ...SIN_CUPON, amount: 318500, amountRaw: '318.500', ids: [OPERACION] };
    const b = { ...SIN_CUPON, amount: 318500, amountRaw: '$318.500', ids: [OPERACION] };
    const r = crossCheckReadings(a, b);
    check('los dos lectores coinciden en el monto ya parseado', r.values.amount === 318500);
    check('se conserva el importe tal cual está impreso', r.values.amountRaw === '318.500');
    check('318.500 leído bien NO difiere de los 318.501 cargados', Math.abs(r.values.amount - 318501) <= 5);
}
{
    check('318,5 contra 318.501 es un separador mal leído, no plata', looksLikeSeparatorArtifact(318.5, 318501));
    check('también al revés', looksLikeSeparatorArtifact(318501, 318.5));
    check('un ×100 mal leído también', looksLikeSeparatorArtifact(3185, 318500));
    check('dos montos realmente distintos NO son un artefacto', !looksLikeSeparatorArtifact(150000, 318500));
    check('la mitad no es un artefacto de separador', !looksLikeSeparatorArtifact(159250, 318500));
    check('un monto en cero no dispara nada', !looksLikeSeparatorArtifact(0, 318500));
}

console.log('');
if (fallos > 0) {
    console.error(`${fallos} chequeo(s) fallaron\n`);
    process.exit(1);
}
console.log('Todos los chequeos pasaron\n');
