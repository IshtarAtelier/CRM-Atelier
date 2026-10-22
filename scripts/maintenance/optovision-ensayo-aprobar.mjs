// ────────────────────────────────────────────────────────────────────────────
// ENSAYO DE "APROBAR" DE PUNTA A PUNTA, SIN CREAR NADA: sobre un borrador
// EN_REVISION del 1er par de una promo, hace exactamente lo que hace la
// aprobación salvo los dos clics irreversibles:
//   1. web de la promo (solo lectura): busca cupón por DNI, resuelve, LLENA el
//      formulario del cupón y lo verifica campo por campo — sin "Confirmar";
//   2. OVES (solo lectura): vuelve a llenar el formulario con un cupón de
//      ensayo y comprueba que queda IGUAL al revisado — sin "Grabar"; consulta
//      un pedido real para probar la lectura;
//   3. mail: manda el mail de la promo de PRUEBA a la casilla que se indique
//      (con copia a la misma y el adjunto), nunca a Optovisión.
//
//   DATABASE_URL=<base LOCAL> node --experimental-strip-types --import ./scripts/checks/_alias.mjs --env-file=.env \
//     scripts/maintenance/optovision-ensayo-aprobar.mjs <borradorId> [mailDePrueba] [nºPedidoRealParaConsultar]
// ────────────────────────────────────────────────────────────────────────────
import { writeFile } from 'node:fs/promises';
import { prisma } from '../../src/lib/db.ts';
import { sendEmail } from '../../src/lib/email.ts';
import { conSesionOves } from '../../src/services/lab-modules/optovision/portal.ts';
import { enSoloLectura } from '../../src/services/lab-modules/optovision/borrador-portal.ts';
import { abrirFormulario, llenarFormulario, diferenciasDeFormulario, consultarPedido, pedidoConsultadoEsNuestro } from '../../src/services/lab-modules/optovision/llenar.ts';
import { planConCupon, formularioConCupon, pedidoDeCupon } from '../../src/services/lab-modules/optovision/cupon-web.ts';
import { conSesionPromo, enSoloLecturaWeb, buscarCuponExistente, resolverEnWeb, generarCupon } from '../../src/services/lab-modules/optovision/cupon-robot.ts';
import { leerVentaParaCargaOves } from '../../src/services/lab-modules/optovision/venta.ts';
import { cristalDelSegundoPar } from '../../src/services/lab-modules/optovision/carga.ts';
import { cuerpoDelMail } from '../../src/services/lab-modules/optovision/promo-mail.ts';
import { asuntoDelMail } from '../../src/services/lab-modules/optovision/promo.ts';

const [borradorId, mailDePrueba, numeroReal] = process.argv.slice(2);
if (!borradorId) { console.error('uso: <borradorId> [mailDePrueba] [nºPedidoReal]'); process.exit(2); }
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) { console.error('DATABASE_URL tiene que ser una base LOCAL.'); process.exit(2); }
const salida = `${process.cwd()}/storage/uploads/lab-modulos/optovision`;
const t0 = Date.now(); const seg = () => `${Math.round((Date.now() - t0) / 1000)} s`;
const CUPON_ENSAYO = 'VAENSAYO1';

const b = await prisma.labOrderDraft.findUniqueOrThrow({ where: { id: borradorId } });
const plan = b.payload.plan; const rastro = b.resumenPortal || {};
if (b.status !== 'EN_REVISION' || !rastro.formulario) throw new Error(`el borrador está ${b.status} / sin formulario`);
const venta = await leerVentaParaCargaOves(b.orderId);
console.log(`Borrador ${b.id}: par ${b.pair} · ${plan.productoCRM} · rol ${plan.rolPromo} · promo ${plan.promo?.tipo} ${plan.promo?.marca}`);

// 1. Web de la promo, hasta antes de Confirmar.
if (plan.cuponAutomatico && plan.promo?.marca) {
    const marca = plan.promo.marca;
    const p = pedidoDeCupon({ venta, plan, productoCRMSegundo: cristalDelSegundoPar(venta), genero: plan.opciones.genero });
    if (!p.ok) throw new Error(`cupón: ${p.faltantes.join(' · ')}`);
    const r = await conSesionPromo(marca, (page) => enSoloLecturaWeb(page, async () => {
        const existente = await buscarCuponExistente(page, marca, p.pedido);
        const resolucion = await resolverEnWeb(page, marca, p.pedido);
        const ensayo = await generarCupon(page, marca, p.pedido, resolucion, { ensayo: true });
        return { existente: existente?.pedido.code ?? null, resolucion, ensayo };
    }));
    await writeFile(`${salida}/ensayo-cupon-${b.id}.png`, r.ensayo.captura);
    console.log(`1. WEB DE LA PROMO OK en ${seg()}: cupón previo ${r.existente ?? 'ninguno'} · línea ${r.resolucion.linea.name} · 1º ${r.resolucion.primero.name} · 2º ${r.resolucion.segundo?.name ?? '—'}`);
    console.log('   formulario del cupón verificado campo por campo (sin confirmar); captura:', `ensayo-cupon-${b.id}.png`);
    console.log('   lo que quedó:', JSON.stringify({ ...r.ensayo.quedo, document_number: '…', _token: '…' }));
} else console.log('1. (sin cupón automático en este borrador)');

// 2. OVES, hasta antes de Grabar.
const esperado = planConCupon(plan, plan.cuponAutomatico ? CUPON_ENSAYO : null);
const oves = await conSesionOves((page) => enSoloLectura(page, async () => {
    await abrirFormulario(page, esperado.clase);
    const llenado = await llenarFormulario(page, esperado);
    const dif = diferenciasDeFormulario(formularioConCupon(rastro.formulario, plan.cuponAutomatico ? CUPON_ENSAYO : null), llenado.formulario);
    const captura = await page.screenshot({ fullPage: true, type: 'png' });
    let consulta = null;
    if (numeroReal) { const c = await consultarPedido(page, numeroReal); consulta = { c: c && { estado: c.pel_cod_estado, paciente: c.pel_des_usuarionombre, ref: c.pel_des_pedinterno, fecha: c.pel_fec_pedido }, v: pedidoConsultadoEsNuestro(c, { paciente: plan.paciente, pedinterno: '' }) }; }
    return { dif, captura, consulta, observacion: llenado.formulario.observacion };
}));
await writeFile(`${salida}/ensayo-oves-${b.id}.png`, oves.captura);
console.log(`2. OVES en ${seg()}: formulario vuelto a llenar ${oves.dif.length ? 'con DIFERENCIAS: ' + oves.dif.join(' · ') : 'IGUAL al revisado'} (sin grabar); observación: "${oves.observacion}"`);
if (oves.consulta) console.log('   consulta del pedido real', numeroReal, JSON.stringify(oves.consulta));

// 3. Mail de prueba.
if (mailDePrueba) {
    const asunto = `[PRUEBA] ${asuntoDelMail('ATEL01', '999001', plan.promo?.tipo === 'MI_PRIMER' ? null : '999002')}`;
    const r = await sendEmail({ to: mailDePrueba, cc: mailDePrueba, subject: asunto, text: `ESTO ES UNA PRUEBA DEL ROBOT (no se mandó a Optovisión).\n\n${cuerpoDelMail({ cliente: plan.paciente, primerPar: '999001', segundoPar: plan.promo?.tipo === 'MI_PRIMER' ? null : '999002', cupon: CUPON_ENSAYO, promo: 'Doble Disfrute Varilux', conVoucher: true })}`, attachments: [{ filename: 'captura-oves-ensayo.png', content: oves.captura, contentType: 'image/png' }] });
    console.log(`3. MAIL de prueba a ${mailDePrueba} (cc al mismo, con adjunto): ${r.success ? 'enviado ' + r.messageId : 'FALLÓ ' + r.error}`);
}
await prisma.$disconnect();
