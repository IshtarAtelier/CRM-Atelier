// ────────────────────────────────────────────────────────────────────────────
// El repaso de la venta en texto plano: lo que se envió a fábrica, legible de
// arriba a abajo.
//
// Lo usan la nota del historial de la ficha (para que "ante cualquier
// eventualidad" el paso a paso esté escrito) y el mensaje de WhatsApp de la
// confirmación de compra. El mail y el PDF arman su propio HTML pero con los
// MISMOS datos: `describeLabFrameDetails()` es la única fuente del armazón.
//
// Módulo PURO (sin prisma) para poder usarlo desde cualquier lado.
// ────────────────────────────────────────────────────────────────────────────

import { describeLabFrameDetails, type LabFrameOrder } from './lab-frame-summary';

export interface RecapPrescription {
    sphereOD?: number | string | null; sphereOI?: number | string | null;
    cylinderOD?: number | string | null; cylinderOI?: number | string | null;
    axisOD?: number | string | null; axisOI?: number | string | null;
    additionOD?: number | string | null; additionOI?: number | string | null;
    addition?: number | string | null;
    pd?: number | string | null;
    heightOD?: number | string | null; heightOI?: number | string | null;
    prismOD?: string | null; prismOI?: string | null;
    prescriptionType?: string | null;
    notes?: string | null;
    imageUrl?: string | null;
}

const dato = (v: unknown): string => (v === null || v === undefined || v === '' ? '—' : String(v));

/** ¿Alguno de los items es fotocromático? Hay que aclarárselo al cliente. */
export function tienePhotocromatico(order: LabFrameOrder & { labTreatment?: string | null }): boolean {
    const enItems = (order.items || []).some(it => {
        const txt = `${it.product?.name || it.productNameSnapshot || ''} ${it.product?.type || it.productTypeSnapshot || ''} ${it.product?.category || it.productCategorySnapshot || ''}`.toLowerCase();
        return txt.includes('fotocrom') || txt.includes('transitions');
    });
    const enTratamiento = `${order.labTreatment || ''}`.toLowerCase();
    return enItems || enTratamiento.includes('fotocrom') || enTratamiento.includes('transitions');
}

/**
 * El repaso del armazón, teñido y notas, en texto.
 *
 * @param paraCliente Recorta lo que el cliente NO puede verificar: las medidas
 *   (A/B/ED/Puente) y la altura pupilar son datos de fabricación. Nadie los
 *   confirma mirando sus anteojos, y llenan el mensaje de números que tapan lo
 *   único que sí hay que revisar. Adentro (ficha, laboratorio) van completos.
 */
export function frameRecapText(order: LabFrameOrder, paraCliente = false): string {
    const r = describeLabFrameDetails(order);
    const lineas: string[] = [];

    // Adentro, el origen va en su propia línea. Para el cliente se fusiona con la
    // descripción del armazón: dos líneas seguidas que empiezan con "Armazón:"
    // se leen como un error de copiado.
    if (r.origin && !paraCliente) lineas.push(`Armazón: ${r.origin}`);

    for (const par of r.pairs) {
        if (par.isEmpty) {
            if (!paraCliente) lineas.push(`${par.label}: sin medidas cargadas`);
            continue;
        }
        const tenidoDelPar = par.tint ? `teñido ${par.tint}` : (r.pairs.length > 1 ? 'SIN teñido' : null);
        const partes = paraCliente
            ? [par.shape, par.details, tenidoDelPar].filter(Boolean)
            : [par.shape, par.measurements, par.fitting, par.details, tenidoDelPar].filter(Boolean);
        if (partes.length === 0) continue;
        // Al cliente le alcanza saber de quién es el armazón, no la marca y el
        // modelo repetidos: eso ya está en la descripción de la línea.
        const deQuien = (order as any).frameSource === 'USUARIO' ? 'el tuyo'
            : (order as any).frameSource === 'OPTICA' ? 'de la óptica' : null;
        const sufijo = paraCliente && deQuien && lineas.length === 0 ? ` (${deQuien})` : '';
        lineas.push(`${par.label}: ${partes.join(' · ')}${sufijo}`);
    }

    // Si el cliente trajo su armazón y no se cargó nada más, igual hay que
    // decírselo: es parte de lo que tiene que reconocer.
    if (paraCliente && lineas.length === 0 && r.origin) lineas.push(`Armazón: ${r.origin}`);

    // Con UN armazón, el teñido va en su propia línea y se dice siempre, también
    // cuando no lleva: el silencio es lo que hace dudar a quien lee. Con varios,
    // ya quedó pegado a cada armazón arriba — repetirlo suelto sería justo lo
    // que genera la confusión de "¿cuál va teñido?".
    if (r.pairs.length <= 1) {
        lineas.push(`Teñido: ${r.tint ? r.tint.text : 'NO lleva teñido'}`);
    }
    if (r.tint?.ambiguousPair) {
        lineas.push('⚠️ Hay un teñido sin asignar a ningún armazón: confirmar a cuál corresponde antes de fabricar.');
    }
    if (tienePhotocromatico(order)) {
        lineas.push('Fotocromático: SÍ — los cristales se oscurecen solos con el sol.');
    }

    if (r.notes) lineas.push(`Notas para el laboratorio: ${r.notes}`);

    return lineas.join('\n');
}

/** La receta tal cual está cargada, en dos filas OD/OI. */
export function prescriptionRecapText(rx: RecapPrescription | null | undefined, paraCliente = false): string {
    if (!rx) return paraCliente ? '' : 'Receta: no hay una receta cargada en este pedido.';

    // Para el cliente: si la receta está vacía (todo en cero o sin cargar), no
    // se manda una tabla de guiones. Una fila que dice "Esf 0 · Cil — · Eje —"
    // no informa nada y hace dudar de todo lo demás.
    if (paraCliente) {
        const algo = [rx.sphereOD, rx.sphereOI, rx.cylinderOD, rx.cylinderOI, rx.additionOD, rx.additionOI, rx.pd]
            .some(v => v !== null && v !== undefined && v !== '' && Number(v) !== 0);
        if (!algo) return '';
    }

    const ojo = (lado: 'OD' | 'OI') => {
        const esf = lado === 'OD' ? rx.sphereOD : rx.sphereOI;
        const cil = lado === 'OD' ? rx.cylinderOD : rx.cylinderOI;
        const eje = lado === 'OD' ? rx.axisOD : rx.axisOI;
        const add = lado === 'OD' ? (rx.additionOD ?? rx.addition) : (rx.additionOI ?? rx.addition);
        const alt = lado === 'OD' ? rx.heightOD : rx.heightOI;
        const prisma = lado === 'OD' ? rx.prismOD : rx.prismOI;
        const partes = [
            `Esf ${dato(esf)}`, `Cil ${dato(cil)}`, `Eje ${dato(eje)}`,
            `Add ${dato(add)}`, `Altura ${dato(alt)}`,
        ];
        if (prisma) partes.push(`Prisma ${prisma}`);
        return `${lado}: ${partes.join('  ')}`;
    };

    const lineas = [
        rx.prescriptionType ? `Tipo de lente: ${rx.prescriptionType}` : null,
        ojo('OD'),
        ojo('OI'),
        `Distancia interpupilar (DNP): ${dato(rx.pd)}`,
        rx.notes ? `Observaciones de la receta: ${rx.notes}` : null,
    ].filter(Boolean) as string[];

    return lineas.join('\n');
}


/**
 * EL REGISTRO COMPLETO de la venta, para la ficha del cliente.
 *
 * Es el documento al que se recurre "ante cualquier eventualidad": tiene que
 * alcanzar por sí solo para reconstruir qué se vendió, sin abrir el pedido ni
 * cruzar pantallas. Va detrás del separador de detalle, así que la ficha lo
 * muestra colapsado y el historial sigue siendo escaneable.
 *
 * A diferencia del mensaje al cliente, acá NO se recorta nada: las medidas, las
 * alturas y la receta completa son justamente lo que hace falta si hay que
 * rehacer un par o discutir con el laboratorio.
 */
export function ventaRecapCompleto(order: any, rx: RecapPrescription | null | undefined): string {
    const plata = (n: number) => `$${Math.round(n || 0).toLocaleString('es-AR')}`;
    const total = order?.total || 0;
    const pagado = order?.paid || 0;
    const bloques: string[] = [];

    bloques.push([
        `Abonado: ${plata(pagado)} · Saldo: ${plata(Math.max(0, total - pagado))}`,
    ].join('\n'));

    // Productos con su precio, y el teñido con su color y a qué armazón va.
    const items: any[] = order?.items || [];
    if (items.length > 0) {
        const lineas = items.map((it: any) => {
            const nombre = [it.product?.brand || it.productBrandSnapshot, it.product?.name || it.productNameSnapshot]
                .filter(Boolean).join(' · ') || 'Artículo';
            const extras = [
                it.eye ? (it.eye === 'RIGHT' || it.eye === 'OD' ? 'OD' : 'OI') : null,
                it.crystalColor || null,
                it.crystalColorNote ? `grado ${it.crystalColorNote}` : null,
                it.framePosition ? `→ ${it.framePosition}º armazón` : null,
            ].filter(Boolean);
            const precio = (it.price || 0) === 0 ? 'SIN CARGO' : plata(it.price);
            return `• ${nombre}${extras.length ? ` (${extras.join(' · ')})` : ''} — ${precio}`;
        });
        bloques.push([`PRODUCTOS`, ...lineas].join('\n'));
    }

    bloques.push([`ARMAZÓN Y TEÑIDO`, frameRecapText(order)].join('\n'));

    // Qué armazones tienen foto: si falta alguna, que se vea acá y no cuando
    // haga falta para responder un reclamo.
    const armazones = describeLabFrameDetails(order).pairs;
    if (armazones.length > 0) {
        const fotos = armazones.map(p =>
            `${p.label}: ${p.imageUrl ? 'foto cargada ✓' : 'SIN FOTO'}`);
        bloques.push([`FOTOS DEL ARMAZÓN`, ...fotos].join('\n'));
    }

    bloques.push([`RECETA (congelada al enviar a fábrica)`, prescriptionRecapText(rx)].join('\n'));

    // Las notas de laboratorio ya salen dentro de ARMAZÓN Y TEÑIDO: repetirlas
    // en su propio bloque hacía leer dos veces lo mismo.

    return bloques.join('\n\n');
}
