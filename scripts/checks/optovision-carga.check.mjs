// ────────────────────────────────────────────────────────────────────────────
// CARGA DE OPTOVISIÓN: lo puro de las promos (src/services/lab-modules/optovision/promo.ts).
//
// Procedimiento oficial (Optovisión Essilor, 23/9/2026): cupón en la web de la
// promo + mail a promociones@ y cordoba@ + observación en cada par. Si falta un
// paso cobran los dos pares: ningún texto sale incompleto y la lista de pasos
// pendientes nunca se da por vacía con algo sin hacer.
//
// Sin base ni red. Corre en CI.   npm run check:carga-optovision
// ────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { marcaDePromo, WEB_DE_PROMO, DESTINATARIOS_PROMO, cuponLimpio, observacionPrimerPar, observacionSegundoPar, asuntoDelMail, pasosPendientes } from '../../src/services/lab-modules/optovision/promo.ts';

let n = 0;
const t = (nombre, fn) => { fn(); n++; };

t('marca de la promo por texto', () => {
    assert.equal(marcaDePromo('Mi primer Varilux'), 'VARILUX');
    assert.equal(marcaDePromo('Kodak Precise'), 'KODAK');
    assert.equal(marcaDePromo('Hoya LifeStyle'), null);
    assert.equal(marcaDePromo(null), null);
});
t('webs y destinatarios', () => {
    assert.match(WEB_DE_PROMO.VARILUX, /variluxdobledisfrute/);
    assert.match(WEB_DE_PROMO.KODAK, /lenteskodak/);
    assert.deepEqual([...DESTINATARIOS_PROMO], ['promociones@optovisionsa.com.ar', 'cordoba@optovisionsa.com.ar']);
});
t('observación del 1º par exige cupón', () => {
    assert.equal(observacionPrimerPar('ABC123'), 'Primer par de Promo num cupón ABC123');
    assert.equal(observacionPrimerPar(' AB C123 '), 'Primer par de Promo num cupón ABC123');
    assert.equal(observacionPrimerPar(''), null);
    assert.equal(observacionPrimerPar(undefined), null);
    assert.equal(cuponLimpio(null), '');
});
t('observación del 2º par exige el nº del 1º', () => {
    assert.equal(observacionSegundoPar('623012'), 'Segundo par promo compañero/asociado al num 623012');
    assert.equal(observacionSegundoPar(' 623012 '), 'Segundo par promo compañero/asociado al num 623012');
    assert.equal(observacionSegundoPar('SML-abc'), null);
    assert.equal(observacionSegundoPar(''), null);
});
t('asunto del mail', () => {
    assert.equal(asuntoDelMail('VERO02', '613534', '613524'), 'VERO02 613534-613524');
    assert.equal(asuntoDelMail('', '613534', '613524'), null);
    assert.equal(asuntoDelMail('VERO02', '613534', ''), null);
});
t('pasos pendientes, en orden, y vacío solo con todo hecho', () => {
    assert.deepEqual(pasosPendientes({}), ['CUPON', 'OBSERVACION_PRIMER_PAR', 'OBSERVACION_SEGUNDO_PAR', 'MAIL']);
    assert.deepEqual(pasosPendientes({ cupon: 'X1', numeroPrimerPar: '623012' }), ['OBSERVACION_SEGUNDO_PAR', 'MAIL']);
    assert.deepEqual(pasosPendientes({ cupon: 'X1', numeroPrimerPar: '623012', numeroSegundoPar: '623013' }), ['MAIL']);
    assert.deepEqual(pasosPendientes({ cupon: 'X1', numeroPrimerPar: '623012', numeroSegundoPar: '623013', mailEnviado: true }), []);
});

console.log(`check:carga-optovision OK (${n} grupos)`);
