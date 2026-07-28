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
    mergeIds,
    referencesMatch
} from '../../src/lib/receipt-references.ts';

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
    check('se descartan cadenas de menos de 5 caracteres y lo que no es texto', ids.length === 1 && ids[0] === '1700293');
}

console.log('\nCruce de las dos lecturas OCR');
{
    const a = { amount: 166774, cuit: '30716850090', date: '2026-07-28', ids: [OPERACION] };
    const b = { amount: 166774, cuit: '30-71685009-0', date: '2026-07-28', ids: [IDENTIFICACION] };
    const r = crossCheckReadings(a, b);
    check('coincidiendo, el monto queda habilitado para auditar', r.values.amount === 166774);
    check('el CUIT con y sin guiones es el mismo', r.values.cuit === '30716850090');
    check('la fecha queda habilitada', r.values.date === '2026-07-28');
    check('los identificadores de las dos lecturas se unen', r.values.ids.length === 2);
    check('sin desacuerdos', r.disagreements.length === 0);
    check('las dos lecturas listaron identificadores', r.bothListedIds === true);
}
{
    const a = { amount: 166774, cuit: null, date: '2026-07-28', ids: [OPERACION] };
    const b = { amount: 16677, cuit: null, date: '2026-07-21', ids: [OPERACION] };
    const r = crossCheckReadings(a, b);
    check('montos distintos → NO se audita el monto', r.values.amount === null);
    check('fechas distintas → NO se audita la fecha', r.values.date === null);
    check('los desacuerdos quedan anotados para el admin', r.disagreements.length === 2);
}
{
    const a = { amount: 166774, cuit: '30716850090', date: '2026-07-28', ids: [OPERACION] };
    const r = crossCheckReadings(a, null);
    check('si el segundo lector falla, no se audita nada', r.values.amount === null && r.values.cuit === null && r.values.date === null);
    check('y no se puede reclamar una referencia', r.bothListedIds === false);
    check('pero los identificadores siguen sirviendo para detectar duplicados', r.values.ids.length === 1);
}
{
    const a = { amount: null, cuit: null, date: null, ids: [OPERACION] };
    const b = { amount: null, cuit: null, date: null, ids: [] };
    const r = crossCheckReadings(a, b);
    check('si un lector no vio ningún identificador, no se reclama la referencia', r.bothListedIds === false);
}

console.log('\nUnión de identificadores');
check('no se duplica el mismo id escrito distinto', mergeIds([OPERACION], ['170.029.330.395']).length === 1);

console.log('');
if (fallos > 0) {
    console.error(`${fallos} chequeo(s) fallaron\n`);
    process.exit(1);
}
console.log('Todos los chequeos pasaron\n');
