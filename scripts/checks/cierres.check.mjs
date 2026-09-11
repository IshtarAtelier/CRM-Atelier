// ────────────────────────────────────────────────────────────────────────────
// OPORTUNIDADES DE CIERRE Y TAREAS: las reglas que se rompen en silencio.
//
// Ishtar, 10/9/2026: "que los cierres nunca estén duplicados", los
// importantes del mes siempre presentes, y en la campanita de Tareas SOLO lo
// que programa una persona. Ninguna de esas reglas la agarra un typecheck:
// este check las prueba con fixtures, SIN base y SIN red (corre en CI).
//
// Correr:  npm run check:cierres
// ────────────────────────────────────────────────────────────────────────────

import {
    agruparPorPersona, armarPanel, esLenteEspecial, esGraduacionAlta,
    llaveTelefono, llaveNombre,
} from '../../src/lib/cierres/armado.ts';
import { telefonoLegible } from '../../src/lib/phone-utils.ts';
import { SOLO_DEL_VENDEDOR, SOLO_DEL_EMBUDO, TIPO_EMBUDO } from '../../src/lib/tareas/origen.ts';

let ok = 0;
const fallas = [];
const check = (nombre, cond, extra = '') => {
    if (cond) { ok++; console.log(`  ✓ ${nombre}`); }
    else { fallas.push(nombre); console.log(`  ✗ ${nombre} ${extra}`); }
};

let n = 0;
const opp = (o) => ({
    id: `o${++n}`, type: 'PENDING_QUOTE', title: 't', clientName: 'Ana Pérez', clientId: `c${n}`,
    phone: null, email: null, isPriority: false, importante: false, detail: '',
    amount: 100000, daysElapsed: 5, lastActivity: new Date().toISOString(), ...o,
});

console.log('\nUna persona = una tarjeta');
{
    const r = agruparPorPersona([
        opp({ clientName: 'Juana Gómez', phone: '0351 15 6123456' }),
        opp({ clientName: 'J Gomez', phone: '+54 9 351 612-3456' }),
    ]);
    check('dos fichas con el mismo teléfono en distinto formato → una tarjeta', r.length === 1);
    check('…y la tarjeta se lleva las dos fichas', r[0]?.fichas.length === 2);
}
{
    // A y C no comparten nada; B las une y aparece ÚLTIMO. La versión de una
    // sola pasada dejaba a esta persona dos veces.
    const r = agruparPorPersona([
        opp({ clientName: 'Uno', phone: '3511111111', email: null }),
        opp({ clientName: 'Dos', phone: null, email: 'x@y.com' }),
        opp({ clientName: 'Tres', phone: '3511111111', email: 'x@y.com' }),
    ]);
    check('unión transitiva: A–(tel)–C–(mail)–B → una sola tarjeta', r.length === 1, `(quedaron ${r.length})`);
}
{
    const r = agruparPorPersona([opp({ clientName: 'Sandra' }), opp({ clientName: 'Sandra' })]);
    check('"Sandra" a secas NO une a dos personas distintas', r.length === 2);
    const r2 = agruparPorPersona([opp({ clientName: 'Viviana Espeche' }), opp({ clientName: 'viviana  espéche' })]);
    check('nombre completo (sin tildes ni mayúsculas) sí une', r2.length === 1);
}
{
    const r = agruparPorPersona([
        opp({ clientName: 'Leo Díaz', phone: '3512222222', importante: false, amount: 90000 }),
        opp({ clientName: 'Leo Díaz', phone: '3512222222', importante: true, amount: 400000 }),
    ]);
    check('la tarjeta que queda es la más importante de esa persona', r[0]?.tarjeta.importante === true);
}

console.log('\n"Ya le escribí"');
{
    const personas = agruparPorPersona([
        opp({ clientName: 'Común Uno', clientId: 'cc1', importante: false }),
        opp({ clientName: 'Imp Uno', clientId: 'ci1', importante: true, amount: 500000 }),
        opp({ clientName: 'Imp Dos', clientId: 'ci2', importante: true, amount: 300000 }),
        opp({ clientName: 'Común Dos', clientId: 'cc2', importante: false }),
    ]);
    const hoy = new Date().toISOString();
    const panel = armarPanel(personas, new Map([
        ['cc1', { cuando: hoy, quien: 'Milena' }],
        ['ci1', { cuando: hoy, quien: null }],
    ]));
    const ids = panel.map(o => o.clientId);
    check('lo común al que ya le escribieron se esconde', !ids.includes('cc1'));
    check('lo importante al que ya le escribieron QUEDA', ids.includes('ci1'));
    check('…al fondo', ids[ids.length - 1] === 'ci1', `(orden: ${ids.join(',')})`);
    check('…marcado con quién y cuándo', !!panel.find(o => o.clientId === 'ci1')?.yaEscrito);
    check('los importantes sin escribir van arriba', ids[0] === 'ci2', `(orden: ${ids.join(',')})`);
}
{
    const personas = agruparPorPersona([
        opp({ clientName: 'Mia Ruiz', clientId: 'f1', phone: '3513333333' }),
        opp({ clientName: 'Mia R', clientId: 'f2', phone: '3513333333' }),
    ]);
    const panel = armarPanel(personas, new Map([['f2', { cuando: new Date().toISOString(), quien: 'Matías' }]]));
    check('escribirle en CUALQUIERA de sus fichas cuenta', panel.length === 0);
}

console.log('\nTicket alto');
check('multifocal es especial', esLenteEspecial('Varilux MULTIFOCAL comfort'));
check('miopía (con tilde) es especial', esLenteEspecial('Control de miopía Myofix'));
check('monofocal común no', !esLenteEspecial('Monofocal orgánico blanco'));
check('esfera -4 es graduación alta', esGraduacionAlta([-4], [0]));
check('cilindro -1.75 no', !esGraduacionAlta([-1], [-1.75]));

console.log('\nTeléfonos');
check('mismas llaves para 0351 15…, +54 9… y pelado',
    new Set(['0351 15 6123456', '+54 9 351 612-3456', '3516123456'].map(llaveTelefono)).size === 1);
check('Córdoba se lee 351 (no 3512)', telefonoLegible('3512008711') === '+54 9 351 200-8711', telefonoLegible('3512008711'));
check('Carlos Paz se lee 3541', telefonoLegible('3541215971') === '+54 9 3541 215-971');
check('Buenos Aires se lee 11', telefonoLegible('011 15 4567 8901') === '+54 9 11 4567-8901');
check('un número raro se muestra tal cual', telefonoLegible('54930000492') === '54930000492');
check('nombre de una sola palabra no es llave', llaveNombre('Fernando') === null);

console.log('\nTareas: solo las del vendedor');
{
    const ors = (SOLO_DEL_VENDEDOR.AND ?? []).flatMap(c => c.OR ?? []);
    // En SQL `NULL NOT IN (...)` no es TRUE: sin este OR la campanita quedó en
    // CERO, tapando las tareas viejas escritas a mano. Se probó el 10/9/2026.
    check('las tareas SIN autor siguen visibles (el OR con null existe)', ors.some(o => o.createdBy === null));
    check('la campanita solo mira type TASK', SOLO_DEL_VENDEDOR.type === 'TASK');
    check('el embudo tiene su propio tipo', SOLO_DEL_EMBUDO.type === TIPO_EMBUDO && TIPO_EMBUDO !== 'TASK');
}

console.log(`\n${ok} ok, ${fallas.length} fallas`);
if (fallas.length) { console.log('FALLAS:', fallas.join(' · ')); process.exit(1); }
