// ────────────────────────────────────────────────────────────────────────────
// Fusiona fichas de cliente DUPLICADAS: mismo teléfono (últimos 10 dígitos) y
// mismo nombre. Un teléfono compartido con nombres distintos es una familia y
// NO se toca (la regla es la misma que usa el bot, esMismaPersona).
//
// Caso que lo motivó: el 21/9/2026 el bot creó 8 fichas "Titino" con el mismo
// número en el mismo segundo (carrera en ContactService.create, ya arreglada
// con un candado por teléfono). Los presupuestos y seguimientos quedaron en una,
// las otras siete vacías pero visibles.
//
// Qué hace por cada grupo:
//   - elige la ficha que SOBREVIVE: la que más datos tiene (email, DNI, fecha de
//     nacimiento, dirección, obra social, médico) y, a igual cantidad, la más
//     antigua;
//   - le mueve interacciones, ventas/presupuestos, tareas, recetas, chats de
//     WhatsApp, carritos, casos de post-venta, envíos programados, seguimientos
//     y etiquetas de las otras;
//   - completa en la sobreviviente los datos que le faltan y las otras sí tienen;
//   - marca las otras como borradas (isDeleted), deja una nota firmada en la
//     ficha sobreviviente y una fila en AuditLog por cada fusión.
// No borra filas: todo queda rastreable.
//
// ⚠️ ESCRIBE en la base que diga FUSION_DB_URL (o DATABASE_URL). Por defecto
// SIMULA y muestra qué haría; solo ejecuta con --aplicar.
//
//   node --env-file=.env scripts/maintenance/fusionar-contactos-duplicados.mjs
//   node --env-file=.env scripts/maintenance/fusionar-contactos-duplicados.mjs --telefono 3517879038
//   FUSION_DB_URL="$PROD_DATABASE_URL" node --env-file=.env \
//     scripts/maintenance/fusionar-contactos-duplicados.mjs --aplicar
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const url = process.env.FUSION_DB_URL || process.env.DATABASE_URL;
if (!url) {
    console.error('Falta FUSION_DB_URL o DATABASE_URL en el entorno.');
    process.exit(1);
}
const esProd = !/localhost|127\.0\.0\.1/.test(url);
const aplicar = process.argv.includes('--aplicar');
const iTel = process.argv.indexOf('--telefono');
const soloTelefono = iTel > -1 ? String(process.argv[iTel + 1] || '').replace(/\D/g, '').slice(-10) : null;
const prisma = new PrismaClient({ datasources: { db: { url } } });

console.log(`\n— Fusión de fichas duplicadas (base: ${esProd ? 'PRODUCCIÓN' : 'local'} · modo: ${aplicar ? 'APLICAR' : 'simulacro'}${soloTelefono ? ` · solo …${soloTelefono}` : ''}) —\n`);

const CAMPOS_DATO = ['email', 'dni', 'birthDate', 'address', 'insurance', 'doctor', 'metaLid', 'adTag', 'adSourceId', 'interest'];
const ultimos10 = (tel) => String(tel || '').replace(/\D/g, '').slice(-10);
const nombreNorm = (n) => String(n || '').toLowerCase().replace(/\s+/g, ' ').trim();
const cantidadDeDatos = (c) => CAMPOS_DATO.filter((k) => c[k] != null && String(c[k]).trim() !== '').length;

// Tablas con clientId que se mueven. (Notification y AuditLog no tienen clientId.)
const TABLAS_CON_CLIENTE = [
    ['Interaction', 'interaction'],
    ['Order', 'order'],
    ['ClientTask', 'clientTask'],
    ['Prescription', 'prescription'],
    ['WhatsAppChat', 'whatsAppChat'],
    ['CheckoutSession', 'checkoutSession'],
    ['PostSaleCase', 'postSaleCase'],
    ['EnvioProgramado', 'envioProgramado'],
    ['SeguimientoEnvio', 'seguimientoEnvio'],
];

async function gruposDuplicados() {
    const clientes = await prisma.client.findMany({
        where: { isDeleted: false, phone: { not: null } },
        select: {
            id: true, name: true, phone: true, createdAt: true,
            ...Object.fromEntries(CAMPOS_DATO.map((k) => [k, true])),
            _count: { select: { interactions: true, orders: true, tasks: true, prescriptions: true, whatsappChats: true, checkoutSessions: true, postSaleCases: true, tags: true } },
        },
    });
    const porClave = new Map();
    for (const c of clientes) {
        const tel = ultimos10(c.phone);
        if (tel.length < 8) continue;
        if (soloTelefono && tel !== soloTelefono) continue;
        const clave = `${tel}|${nombreNorm(c.name)}`;
        if (!porClave.has(clave)) porClave.set(clave, []);
        porClave.get(clave).push(c);
    }
    return [...porClave.values()].filter((g) => g.length > 1);
}

function elegirSobreviviente(grupo) {
    return [...grupo].sort((a, b) =>
        cantidadDeDatos(b) - cantidadDeDatos(a) || a.createdAt.getTime() - b.createdAt.getTime(),
    )[0];
}

async function fusionar(grupo) {
    const sobreviviente = elegirSobreviviente(grupo);
    const otras = grupo.filter((c) => c.id !== sobreviviente.id);
    const totalFilas = (c) => Object.values(c._count).reduce((a, b) => a + b, 0);

    console.log(`\n📞 …${ultimos10(sobreviviente.phone)} · "${sobreviviente.name}" · ${grupo.length} fichas`);
    console.log(`   ✅ sobrevive ${sobreviviente.id} (creada ${sobreviviente.createdAt.toISOString().slice(0, 10)}, ${cantidadDeDatos(sobreviviente)} datos, ${totalFilas(sobreviviente)} filas relacionadas)`);
    for (const o of otras) {
        const detalle = Object.entries(o._count).filter(([, n]) => n > 0).map(([k, n]) => `${k}: ${n}`).join(', ') || 'vacía';
        console.log(`   ↪ absorbe ${o.id} (creada ${o.createdAt.toISOString().slice(0, 10)}, ${detalle})`);
    }
    const completar = {};
    for (const k of CAMPOS_DATO) {
        if (sobreviviente[k] != null && String(sobreviviente[k]).trim() !== '') continue;
        const donante = otras.find((o) => o[k] != null && String(o[k]).trim() !== '');
        if (donante) completar[k] = donante[k];
    }
    if (Object.keys(completar).length) console.log(`   ✏️  completa en la sobreviviente: ${Object.keys(completar).join(', ')}`);

    if (!aplicar) return;

    const idsOtras = otras.map((o) => o.id);
    await prisma.$transaction(async (tx) => {
        const movidas = {};
        for (const [nombre, delegado] of TABLAS_CON_CLIENTE) {
            const r = await tx[delegado].updateMany({ where: { clientId: { in: idsOtras } }, data: { clientId: sobreviviente.id } });
            if (r.count) movidas[nombre] = r.count;
        }
        // Etiquetas (tabla implícita _ClientToTag: A = Client, B = Tag): se
        // agregan a la sobreviviente las que no tenga y se sueltan de las otras.
        await tx.$executeRaw`
            INSERT INTO "_ClientToTag" ("A", "B")
            SELECT DISTINCT ${sobreviviente.id}, "B" FROM "_ClientToTag"
            WHERE "A" = ANY(${idsOtras})
            ON CONFLICT DO NOTHING`;
        await tx.$executeRaw`DELETE FROM "_ClientToTag" WHERE "A" = ANY(${idsOtras})`;

        // El email es único: primero se suelta de la donante.
        if (completar.email) {
            await tx.client.updateMany({ where: { id: { in: idsOtras }, email: completar.email }, data: { email: null } });
        }
        await tx.client.updateMany({
            where: { id: { in: idsOtras } },
            data: { isDeleted: true, opportunityDismissedAt: new Date() },
        });
        await tx.client.update({ where: { id: sobreviviente.id }, data: completar, select: { id: true } });

        const resumen = Object.entries(movidas).map(([k, n]) => `${k}: ${n}`).join(', ') || 'nada que mover';
        await tx.interaction.create({
            data: {
                clientId: sobreviviente.id,
                type: 'NOTE',
                userName: 'Sistema',
                content: `🧹 Sistema fusionó ${otras.length} ficha(s) duplicada(s) en esta (mismo teléfono y nombre): ${idsOtras.join(', ')}. Movido: ${resumen}.`,
            },
        });
        await tx.auditLog.create({
            data: {
                userName: 'Sistema',
                action: 'CLIENT_MERGE',
                entityType: 'Client',
                entityId: sobreviviente.id,
                details: { absorbidas: idsOtras, movidas, completado: Object.keys(completar), script: 'scripts/maintenance/fusionar-contactos-duplicados.mjs' },
            },
        });
    }, { timeout: 60_000 });
    console.log('   💾 aplicado');
}

try {
    const grupos = await gruposDuplicados();
    if (!grupos.length) {
        console.log('No hay fichas duplicadas (mismo teléfono y mismo nombre).');
    } else {
        console.log(`${grupos.length} grupo(s) de duplicados, ${grupos.reduce((a, g) => a + g.length - 1, 0)} ficha(s) a absorber.`);
        for (const g of grupos) await fusionar(g);
        if (!aplicar) console.log('\nSimulacro: nada se escribió. Para aplicar, agregar --aplicar.');
    }
} finally {
    await prisma.$disconnect();
}
