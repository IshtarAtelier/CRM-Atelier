import type { Page } from 'playwright';
import { NOMBRE_OPTOVISION, pedirJsonOves } from './portal';
import type { PlanOves } from './carga';
import { FORMAS_OVES } from './catalogo';
import { parDelCodigoInterno } from '../../../lib/laboratorios/identidad';

/**
 * EL ROBOT SOBRE EL FORMULARIO DE OVES (docs/oves-portal.md).
 *
 * El formulario vive en una sola página: abrir "Nuevo Pedido → Tallado
 * Digital / Tradicional / Stock con Adicionales" dibuja `form#form` y de ahí en
 * más TODO es local al navegador hasta que se aprieta Grabar. Por eso la
 * "pantalla real" sale gratis: el robot llena, lee lo que quedó en cada campo
 * y saca la captura SIN mandar nada. Grabar (`grabarPedido`) es el único
 * momento que escribe en el laboratorio, y solo corre tras el OK humano.
 *
 * Todo con tope ancho (ESPERA_OVES_MS en portal.ts): el portal tarda 2–4 s
 * por consulta y a veces minutos.
 */

/** El id del `li` del menú lateral que abre cada clase de pedido: hoy coinciden con la clase (`resultGrupos` en index.js); si el portal los cambia, se cambia acá. */
const MENU_POR_CLASE: Record<PlanOves['clase'], string> = { RXTD: 'RXTD', RXTT: 'RXTT', RXSA: 'RXSA' };

/** El portal está "Actualizando…" (bloqueo con reloj) o ya libre. */
async function esperarQueTermineDeActualizar(page: Page, maxMs = 10 * 60_000): Promise<void> {
    await page.waitForFunction(() => {
        const b = document.getElementById('bloqueo');
        return !b || b.style.display === 'none' || b.offsetParent === null;
    }, undefined, { timeout: maxMs }).catch(() => null);
}

/** Abre "Nuevo Pedido" y la clase pedida; deja `form#form` dibujado y vacío. */
export async function abrirFormulario(page: Page, clase: PlanOves['clase']): Promise<void> {
    await page.locator('#compras_a').first().click();
    await esperarQueTermineDeActualizar(page);
    const item = page.locator(`#side-menu li#${MENU_POR_CLASE[clase]} a`).first();
    await item.waitFor({ state: 'visible' });
    await item.click();
    await page.waitForSelector('#form #lineaRX', { state: 'visible' });
    await esperarQueTermineDeActualizar(page);
    const claseEnForm = await page.inputValue('#claseDePedido');
    if (claseEnForm !== clase) throw new Error(`${NOMBRE_OPTOVISION}: el formulario abrió como ${claseEnForm || 'sin clase'} y no como ${clase}.`);
}

/** Lo que el portal sabe de un producto: sus servicios y sus reglas (obligatorios, inhabilitados, validaciones). */
export interface ReglasDelProducto {
    servicios: Record<'TRAT' | 'CAL' | 'COL' | 'OTR', { key: string; descripcion: string }[]>;
    obligatorios: string[];
    inhabilitados: string[];
    validaciones: { result: string; mensaje: string }[];
}

/** Pide al portal los servicios y las reglas del producto (solo GET). */
export async function reglasDelProducto(page: Page, value: string): Promise<ReglasDelProducto> {
    const [, , linea, , , , tped] = value.split('|');
    const servicios = {} as ReglasDelProducto['servicios'];
    for (const s of ['TRAT', 'CAL', 'COL', 'OTR'] as const) {
        const r = await pedirJsonOves<{ key: string; descripcion: string }[]>(page, { opc: 'servicio', srvParam: `${s}${value}`, clienteadj: '' });
        servicios[s] = Array.isArray(r) ? r.map(o => ({ key: String(o.key), descripcion: String(o.descripcion) })) : [];
        await page.waitForTimeout(300);
    }
    const regla = async (nombre: string) => { const r = await pedirJsonOves<{ result: string; mensaje?: string }[]>(page, { opc: 'talladoval', linea: linea, tped: tped, regla: nombre, clienteadj: '' }); await page.waitForTimeout(300); return Array.isArray(r) ? r.filter(x => x.result) : []; };
    return {
        servicios,
        obligatorios: (await regla('OBLIG')).map(x => x.result),
        inhabilitados: (await regla('INHABDATO')).map(x => x.result),
        validaciones: (await regla('VALIDAR')).map(x => ({ result: x.result, mensaje: String(x.mensaje ?? '') })),
    };
}

/** El servicio del plan tiene que existir TAL CUAL entre los que el portal ofrece para ese producto; si no, se dice qué ofrece. Puro. */
export function elegirServicio(ofrecidos: { key: string; descripcion: string }[], descripcion: string): { ok: true; key: string } | { ok: false; motivo: string } {
    const norm = (s: string) => s.trim().toLowerCase();
    const exactos = ofrecidos.filter(o => norm(o.descripcion) === norm(descripcion));
    if (exactos.length === 1) return { ok: true, key: exactos[0].key };
    if (exactos.length > 1) return { ok: false, motivo: `el portal ofrece "${descripcion}" ${exactos.length} veces: no se elige "el primero"` };
    return { ok: false, motivo: `el portal no ofrece "${descripcion}" para este producto (ofrece: ${ofrecidos.map(o => o.descripcion).join(' / ') || 'nada'})` };
}

export interface Llenado {
    /** Cada campo escrito, en orden, para el rastro. */
    pasos: { campo: string; valor: string }[];
    /** Lo que quedó en el formulario (lo comparable: se relee al confirmar). */
    formulario: Record<string, string>;
    /** Campos del plan que el portal tiene INHABILITADOS para este producto (no se mandan). */
    noAplican: string[];
    reglas: ReglasDelProducto;
    /** El `uuidHidden` que el portal generó para este formulario. */
    uuid: string;
}

/**
 * Llena el formulario abierto con el plan, campo por campo, y lee lo que quedó.
 * No aprieta Grabar. Si el portal no acepta algo (producto que no resuelve,
 * servicio que no ofrece, `#mensajeRX` con texto), corta con el motivo.
 */
export async function llenarFormulario(page: Page, plan: PlanOves): Promise<Llenado> {
    const pasos: Llenado['pasos'] = [];
    const paso = (campo: string, valor: string) => pasos.push({ campo, valor });
    const jq = async (codigo: string, arg?: unknown) => page.evaluate(({ c, a }) => {
        return new Function('$', 'a', c)((window as any).jQuery, a);
    }, { c: codigo, a: arg });

    // 1. Lentes (AO / OD / OI). ANTES del producto: al resolverlo la app deshabilita estos radios.
    await page.check(`#lentes${plan.lentes}`);
    paso('lentes', plan.lentes);

    // 2. Producto: el label exacto. El `change` del autocompletar (jQuery UI) se
    //    dispara en el blur SOLO si el valor cambió respecto del que había al
    //    hacer foco: foco con el campo vacío → valor → blur (probado en vivo el
    //    20/10/2026; un trigger('change') no hace nada). Ahí la app busca
    //    `exact=` y, si da uno solo, llena el hidden y carga los servicios.
    await jq(`$('#lineaRX').val('').trigger('focus'); $('#lineaRX').val(a); $('#lineaRX').trigger('blur');`, plan.producto.label);
    paso('producto', plan.producto.label);
    await page.waitForFunction((esperado) => {
        const h = (document.getElementById('hiddenLineaRX') as HTMLInputElement | null)?.value || '';
        return h.startsWith(esperado) && (document.querySelectorAll('#serviciosTRAT option').length > 0);
    }, plan.producto.value, { timeout: 10 * 60_000 }).catch(() => null);
    const hidden = await page.inputValue('#hiddenLineaRX');
    if (!hidden.startsWith(plan.producto.value)) {
        throw new Error(`${NOMBRE_OPTOVISION}: el portal no resolvió el producto "${plan.producto.label}" (quedó "${hidden || 'vacío'}"): puede haber cambiado de nombre en OVES; regenerar el catálogo.`);
    }
    const reglas = await reglasDelProducto(page, plan.producto.value);
    // Las reglas de validación de graduación las aplica el portal al grabar: se
    // reportan acá para que la persona las vea antes (p. ej. "Esférico de -10 a +6").
    await page.waitForTimeout(1500);

    // 3. Servicios: por la CLAVE de la opción, verificada contra lo que ofrece el portal.
    const porSelect: [keyof ReglasDelProducto['servicios'], string, string][] = [['TRAT', 'serviciosTRAT', plan.servicios.tratamiento], ['CAL', 'serviciosCAL', plan.servicios.calibrado], ['COL', 'serviciosCOL', plan.servicios.coloracion], ['OTR', 'serviciosOTR', plan.servicios.otros]];
    for (const [tipo, id, descripcion] of porSelect) {
        const r = elegirServicio(reglas.servicios[tipo], descripcion);
        if (!r.ok) throw new Error(`${NOMBRE_OPTOVISION}: ${tipo === 'TRAT' ? 'tratamiento' : tipo === 'CAL' ? 'calibrado' : tipo === 'COL' ? 'coloración' : 'otros'}: ${r.motivo}`);
        await page.selectOption(`#${id}`, { value: r.key });
        await jq(`$('#${id}').trigger('change');`);
        paso(id, descripcion);
    }

    // 4. Prescripción por ojo (solo lo que el portal no tiene inhabilitado).
    // Las reglas pueden venir con sufijo de ojo ("adic_d") o sin él ("adic"): se miran las dos formas.
    const sinOjo = (id: string) => id.replace(/_[di]$/, '');
    const inhabilitados = new Set(reglas.inhabilitados.flatMap(r => [r, sinOjo(r)]));
    const noAplican: string[] = [];
    const escribir = async (id: string, valor: string | null) => {
        if (valor === null || valor === '') return;
        if (inhabilitados.has(id) || inhabilitados.has(sinOjo(id))) { noAplican.push(id); return; }
        const el = page.locator(`#${id}`);
        if (await el.count() === 0) throw new Error(`${NOMBRE_OPTOVISION}: el formulario no tiene el campo ${id}`);
        // Lo que el portal deshabilitó u OCULTÓ en vivo tampoco se escribe (los INHABDATO quedan ocultos, no disabled; un fill sobre uno de esos esperaría el timeout entero).
        if (await el.isDisabled().catch(() => false) || !(await el.isVisible().catch(() => false))) { noAplican.push(id); return; }
        const tag = await el.evaluate(e => e.tagName.toLowerCase());
        if (tag === 'select') {
            const opciones: string[] = await el.evaluate(e => [...(e as HTMLSelectElement).options].map(o => o.value));
            if (!opciones.includes(valor)) throw new Error(`${NOMBRE_OPTOVISION}: ${id} no ofrece "${valor}" (ofrece ${opciones.filter(Boolean).join(', ')})`);
            await el.selectOption({ value: valor });
        } else {
            await el.fill(valor);
        }
        await jq(`$('#${id}').trigger('keyup').trigger('change').trigger('blur');`);
        paso(id, valor);
    };
    for (const [lado, o] of [['d', plan.od], ['i', plan.oi]] as const) {
        if (!o) continue;
        await escribir(`esf_${lado}`, o.esf);
        await escribir(`cil_${lado}`, o.cil);
        await escribir(`eje_${lado}`, o.eje);
        await escribir(`adic_${lado}`, o.adic);
        await escribir(`dnpx_${lado}`, o.dnp);
        await escribir(`altura_${lado}`, o.altura);
    }
    await escribir('diametro', plan.diametro);

    // 5. Armazón.
    if (plan.armazon.forma !== null) {
        if (!(FORMAS_OVES as readonly number[]).includes(plan.armazon.forma)) throw new Error(`${NOMBRE_OPTOVISION}: forma ${plan.armazon.forma} no existe en el formulario`);
        await page.check(`input[name=armazonLente][value="${plan.armazon.forma}"]`);
        await jq(`$('input[name=armazonLente]:checked').trigger('click');`);
        paso('armazonLente', String(plan.armazon.forma));
    }
    if (plan.armazon.tipo) { await page.selectOption('#tipoarm', { value: plan.armazon.tipo }); paso('tipoarm', plan.armazon.tipoEtiqueta ?? plan.armazon.tipo); }
    await escribir('armazona', plan.armazon.a);
    await escribir('armazonb', plan.armazon.b);
    await escribir('armazoned', plan.armazon.ed);
    await escribir('puente', plan.armazon.puente);
    await page.selectOption('#enviaarm', { value: plan.armazon.envia });
    await jq(`$('#enviaarm').trigger('change');`);
    paso('enviaarm', plan.armazon.envia);
    if (plan.armazon.envia === 'Si' && plan.armazon.marca) {
        await page.locator('#marcaarm').evaluate(e => { (e as HTMLElement).style.display = ''; });
        await page.fill('#marcaarm', plan.armazon.marca);
        paso('marcaarm', plan.armazon.marca);
    }

    // 6. Otros.
    await page.fill('#pedinterno', plan.pedinterno); paso('pedinterno', plan.pedinterno);
    await page.fill('#paciente', plan.paciente); paso('paciente', plan.paciente);
    await page.fill('#observacion', plan.observacion); paso('observacion', plan.observacion);
    await jq(`$('#paciente').trigger('blur'); if (typeof valid === 'function') { try { valid(''); } catch (e) {} }`);
    await page.waitForTimeout(1500);

    // 7. ¿El portal tiene algo que objetar? (`#mensajeRX` con texto, obligatorios vacíos)
    // Vacío es '' (tras elegir producto) o '.' (el formulario recién abierto).
    const mensaje = (await page.locator('#mensajeRX').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (mensaje && mensaje !== '.') throw new Error(`${NOMBRE_OPTOVISION}: el formulario marca un problema: "${mensaje}". No se mandó nada.`);
    const vacios: string[] = [];
    const idsObligatorios = [...new Set(reglas.obligatorios.flatMap(r => (/_[di]$/.test(r) ? [r] : [r, `${r}_d`, `${r}_i`])))];
    for (const id of idsObligatorios) {
        const el = page.locator(`#${id}`);
        if (await el.count() === 0) continue;
        const visible = await el.isVisible().catch(() => false);
        if (!visible) continue;
        const v = (await el.inputValue().catch(() => '')).trim();
        if (!v) vacios.push(id);
    }
    if (vacios.length) throw new Error(`${NOMBRE_OPTOVISION}: el portal exige ${vacios.join(', ')} para este producto y la venta no lo tiene. No se mandó nada.`);

    return { pasos, formulario: await leerFormulario(page), noAplican, reglas, uuid: await page.inputValue('#uuidHidden').catch(() => '') };
}

/** Reinyecta el uuid del intento anterior (anti doble envío del lado del portal, si lo deduplica). */
export async function usarUuid(page: Page, uuid: string | null | undefined): Promise<void> {
    if (uuid && /^[0-9a-f-]{36}$/i.test(uuid)) await page.evaluate(u => { const e = document.getElementById('uuidHidden') as HTMLInputElement | null; if (e) e.value = u; }, uuid);
}

/** Lo que quedó en el formulario, campo por campo (name → valor; en los select, el texto de la opción). Es lo comparable. */
export async function leerFormulario(page: Page): Promise<Record<string, string>> {
    return page.evaluate(() => {
        const out: Record<string, string> = {};
        for (const e of Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('#form input, #form select, #form textarea'))) {
            const nombre = e.name || e.id;
            if (!nombre || /^(uuidHidden|grabar|imprimir|limpiar|anulacion|lineaRX)$/.test(nombre)) continue;
            if (e instanceof HTMLInputElement && (e.type === 'radio' || e.type === 'checkbox')) { if (e.checked) out[nombre] = e.value; continue; }
            if (e instanceof HTMLInputElement && (e.type === 'button' || e.type === 'submit' || e.type === 'image')) continue;
            const v = e instanceof HTMLSelectElement ? (e.options[e.selectedIndex]?.text ?? '') : e.value;
            if (String(v).trim() !== '') out[nombre] = String(v).trim();
        }
        return out;
    });
}

/** La pantalla real: el bloque del formulario entero (`#RXcontent`), sin el resto de la página. */
export async function capturarFormulario(page: Page): Promise<Buffer> {
    await page.setViewportSize({ width: 1280, height: 2600 });
    const bloque = page.locator('#RXcontent').first();
    if (await bloque.count()) return bloque.screenshot({ type: 'png' });
    return page.screenshot({ fullPage: true, type: 'png' });
}

/** Qué cambió entre lo que se aprobó y lo que el formulario muestra hoy (misma venta, otra sesión). Puro. */
export function diferenciasDeFormulario(aprobado: Record<string, string>, hoy: Record<string, string>): string[] {
    const ignorar = new Set(['claseDePedido', 'hLineaRX']);
    const norm = (v: string | undefined) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    const claves = [...new Set([...Object.keys(aprobado), ...Object.keys(hoy)])].filter(k => !ignorar.has(k));
    return claves.filter(k => norm(aprobado[k]) !== norm(hoy[k])).map(k => `${k}: se aprobó "${aprobado[k] ?? ''}" y hoy el formulario tiene "${hoy[k] ?? ''}"`);
}

/** El portal CONTESTÓ que no graba (validación): no hay nada creado. */
export class PedidoRechazadoError extends Error {
    constructor(msg: string) { super(msg); this.name = 'PedidoRechazadoError'; }
}
/** El portal contestó con error interno (`error: true`): no se sabe si grabó. */
export class PortalRespondioError extends Error {
    constructor(msg: string) { super(msg); this.name = 'PortalRespondioError'; }
}

/**
 * El nº de pedido web (6 dígitos) que viene en el HTML de la respuesta de
 * grabar. El formato exacto todavía no se vio (docs/oves-portal.md): por eso
 * NUNCA se toma "el primer 6 dígitos" a ciegas — la respuesta puede repetir la
 * observación ("…asociado al num 628377", el nº del OTRO par). Se descartan los
 * nº que no pueden ser (`excluir`: el del 1er par, los que ya tiene la venta) y
 * solo con UN candidato se devuelve; con cero o varios, null (envío incierto,
 * que el reintento resuelve buscando por la referencia). Puro.
 */
export function numeroDeLaRespuesta(html: string, excluir: Iterable<string> = []): string | null {
    const t = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const fuera = new Set([...excluir].map(n => String(n).replace(/\D/g, '')));
    const candidatos = [...new Set([...t.matchAll(/\b(\d{6})\b/g)].map(m => m[1]))].filter(n => !fuera.has(n));
    if (candidatos.length === 1) return candidatos[0];
    // Varios: solo vale el que viene presentado como el nº del pedido.
    const presentado = candidatos.filter(n => new RegExp(`(?:pedido|n[uú]mero|nro\\.?|n[°º])\\s*(?:web|de pedido|generado|creado|:)?\\s*[:#]?\\s*${n}\\b`, 'i').test(t));
    return presentado.length === 1 ? presentado[0] : null;
}

/**
 * GRABAR: el único POST. Aprieta el botón, acepta el `confirm('CONFIRMA EL
 * PEDIDO?')` y lee la respuesta (`#bottomcontent`). Devuelve el nº que asignó
 * el portal. Un rechazo de validación (alert) es PedidoRechazadoError; un
 * error interno, PortalRespondioError (puede haber grabado).
 */
export async function grabarPedido(page: Page, opts: { antesDeConfirmar?: () => Promise<void>; excluir?: Iterable<string> } = {}): Promise<{ numero: string; respuesta: string }> {
    const antes = (await page.locator('#bottomcontent').innerHTML().catch(() => '')) || '';
    // Lo que pasa en los dialogs vive en un objeto (el handler es un closure y
    // TypeScript no ve sus asignaciones desde el loop).
    // La barrera corre ADENTRO del handler del dialog (el único momento entre el
    // clic y el confirm): si falla, el confirm se rechaza y la falla se guarda
    // acá para lanzarla desde el flujo principal — un throw dentro del handler
    // se perdería en el emitter y el robot esperaría 10 minutos en vano.
    const estado: { alerta: string | null; alertaTrasConfirmar: string | null; confirmado: boolean; fallaBarrera: unknown } = { alerta: null, alertaTrasConfirmar: null, confirmado: false, fallaBarrera: null };
    const onDialog = async (d: any) => {
        if (d.type() === 'confirm') {
            // Si antes hubo un alert (rechazo), el confirm que lo siga no se acepta: no se graba sobre un rechazo.
            if (estado.alerta) { await d.dismiss().catch(() => null); return; }
            try { await opts.antesDeConfirmar?.(); } catch (err) { estado.fallaBarrera = err; await d.dismiss().catch(() => null); return; }
            estado.confirmado = true;
            await d.accept().catch(() => null);
        } else {
            // Un alert ANTES del confirm es el portal rechazando (faltan datos, validación).
            // Uno DESPUÉS puede ser el "pedido grabado": nunca se toma como rechazo.
            if (estado.confirmado) estado.alertaTrasConfirmar = d.message(); else estado.alerta = d.message();
            await d.accept().catch(() => null);
        }
    };
    page.on('dialog', onDialog);
    try {
        await page.locator('#grabar').first().click();
        const limite = Date.now() + 10 * 60_000;
        while (Date.now() < limite) {
            await page.waitForTimeout(1000);
            if (estado.fallaBarrera) throw estado.fallaBarrera;
            if (estado.alerta && !estado.confirmado) break;
            if (estado.alertaTrasConfirmar) {
                const numero = numeroDeLaRespuesta(estado.alertaTrasConfirmar, opts.excluir ?? []);
                if (numero) return { numero, respuesta: estado.alertaTrasConfirmar.slice(0, 2000) };
                throw new PortalRespondioError(`${NOMBRE_OPTOVISION} mostró un cartel después de confirmar ("${estado.alertaTrasConfirmar.slice(0, 200)}"): no se sabe si grabó`);
            }
            const ahora = (await page.locator('#bottomcontent').innerHTML().catch(() => '')) || '';
            if (ahora && ahora !== antes && !/<form/i.test(ahora.slice(0, 200))) {
                const texto = ahora.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                if (/error interno|se produjo un error/i.test(texto)) throw new PortalRespondioError(`${NOMBRE_OPTOVISION} respondió con error al grabar: ${texto.slice(0, 300)}`);
                const numero = numeroDeLaRespuesta(ahora, opts.excluir ?? []);
                if (!numero) throw new PortalRespondioError(`${NOMBRE_OPTOVISION} grabó pero no se pudo leer UN nº de pedido en la respuesta: ${texto.slice(0, 300)}`);
                return { numero, respuesta: texto.slice(0, 2000) };
            }
        }
        if (estado.alerta) throw new PedidoRechazadoError(`el portal no aceptó el pedido: ${estado.alerta}`);
        if (!estado.confirmado) throw new PedidoRechazadoError('el portal no pidió confirmar el pedido (faltan datos obligatorios o hay un mensaje pendiente): no se grabó nada');
        throw new PortalRespondioError(`${NOMBRE_OPTOVISION} no respondió al grabar en 10 minutos: no se sabe si lo tomó`);
    } finally {
        page.off('dialog', onDialog);
    }
}

/** Las filas del listado dibujado (`#listapedidos`): nº web, estado y referencia. */
async function filasDelListado(page: Page): Promise<{ numero: string; estado: string; referencia: string }[]> {
    return page.evaluate(() => {
        const out: { numero: string; estado: string; referencia: string }[] = [];
        for (const tr of Array.from(document.querySelectorAll('#listapedidos tbody tr'))) {
            const celdas = Array.from(tr.querySelectorAll('th, td')).map(c => (c as HTMLElement).innerText.trim());
            const numero = (celdas[0] || '').match(/\d{6}/)?.[0];
            if (celdas.length < 5 || !numero) continue;
            out.push({ numero, estado: celdas[2], referencia: celdas[4] });
        }
        return out;
    });
}

const normalizarReferencia = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** ¿La referencia del listado es la nuestra? Igual, o una recortada de la otra (el campo del portal puede cortar). Puro. */
export function referenciaCoincide(enPortal: string, nuestra: string): boolean {
    const a = normalizarReferencia(enPortal), b = normalizarReferencia(nuestra);
    if (!a || !b) return false;
    // Con dos pares, la del portal tiene que decir el MISMO par: "#AB12 Juan" a secas (carga a mano) serviría para los dos.
    // …salvo que la del portal sea la nuestra RECORTADA (un prefijo largo: código + nombre), donde el par quedó afuera del corte.
    const parDe = (t: string) => parDelCodigoInterno(t);
    if (parDe(b) && parDe(a) !== parDe(b)) return b.startsWith(a) && a.length >= 15;
    // Mismo par escrito distinto ("2do par" / "2° par"): se compara lo que queda sin el par.
    const sinPar = (t: string) => t.replace(/\s*(?:\d\s*(?:[°ºo]|do|er|ro)?\s*par|primer\s+par|segundo\s+par)\b.*$/, '').trim();
    const [x, y] = parDe(a) && parDe(a) === parDe(b) ? [sinPar(a), sinPar(b)] : [a, b];
    return x === y || x.startsWith(y) || y.startsWith(x);
}

/**
 * Busca en el listado del portal un pedido por su "Referencia Cliente" (el
 * `#XXXX Nombre N°par` del plan). Devuelve los nº web que la tienen, del más
 * nuevo al más viejo. Solo lee. ANTES de aceptar un "no está", comprueba que
 * el listado sin filtro se lea con filas (un listado vacío o que no parsea NO
 * es "no existe": es la sesión o el portal rotos, y crear sería duplicar;
 * lección de Grupo Óptico).
 */
export async function buscarPorReferencia(page: Page, referencia: string): Promise<{ numero: string; estado: string; referencia: string }[]> {
    await page.locator('#historialrx_a').first().click();
    await esperarQueTermineDeActualizar(page);
    await page.waitForSelector('#listapedidos', { state: 'attached' });
    await page.waitForTimeout(1500);
    const canario = await filasDelListado(page);
    if (canario.length === 0) throw new Error(`${NOMBRE_OPTOVISION}: el listado de pedidos del portal vino vacío o no se pudo leer; no se puede comprobar si el pedido ya existe, así que no se crea nada.`);
    await page.locator('#side-menu li#BU a').first().waitFor({ state: 'visible' });
    await page.locator('#side-menu li#BU a').first().click();
    await page.waitForSelector('#bus_refped_int', { state: 'visible' });
    await page.fill('#bus_refped_int', referencia.slice(0, 30));
    await page.locator('#buscar_rx').click();
    await esperarQueTermineDeActualizar(page);
    await page.waitForSelector('#listapedidos', { state: 'attached' });
    await page.waitForTimeout(1500);
    const filas = await filasDelListado(page);
    const propias = filas.filter(f => referenciaCoincide(f.referencia, referencia));
    // Si el buscador no trajo nada pero el listado sin filtro sí tenía la referencia, vale lo del listado.
    return propias.length ? propias : canario.filter(f => referenciaCoincide(f.referencia, referencia));
}

/** La consulta de un pedido (`opc=consulta&nroPed=`): el JSON crudo del portal, o null si no existe / no se pudo leer. Solo lee. */
export async function consultarPedido(page: Page, numero: string): Promise<Record<string, unknown> | null> {
    // Un error de red o del portal se RELANZA (no es "no existe"): quien llama decide si queda incierto.
    const r = await pedirJsonOves<unknown>(page, { opc: 'consulta', nroPed: numero });
    const fila = Array.isArray(r) ? r[0] : r;
    return fila && typeof fila === 'object' && Object.keys(fila as object).length > 0 ? (fila as Record<string, unknown>) : null;
}

/** "17/10/2026 16:26:31" (como lo muestra el portal) → Date; null si no se entiende. Puro. */
export function fechaDelPortal(texto: unknown): Date | null {
    const m = String(texto ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!m) { const d = new Date(String(texto ?? '')); return Number.isNaN(d.getTime()) ? null : d; }
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0));
}

/** ¿La consulta de un pedido es de ESTA venta (nombra al paciente o la referencia) y está vivo (no anulado)? Puro. */
export function pedidoConsultadoEsNuestro(consulta: Record<string, unknown> | null, o: { paciente: string; pedinterno: string; desde?: Date | null }): { ok: boolean; motivo: string; vivo: boolean } {
    if (!consulta) return { ok: false, motivo: 'no existe en el portal (la consulta vino vacía)', vivo: false };
    const estado = String(consulta.pel_cod_estado ?? '').toUpperCase();
    if (estado === 'AN') return { ok: false, motivo: 'está ANULADO en el portal', vivo: false };
    const solicitud = String(consulta.pel_est_solanul ?? 'N').toUpperCase();
    if (solicitud === 'S') return { ok: false, motivo: 'tiene una solicitud de anulación en proceso', vivo: false };
    // Un pedido más viejo que la venta no es de esta venta (un nº de otra compra del mismo cliente tipeado en la venta).
    const fecha = fechaDelPortal(consulta.pel_fec_pedido);
    if (o.desde && fecha && fecha.getTime() < o.desde.getTime() - 86400000) return { ok: false, motivo: `es del ${fecha.toLocaleDateString('es-AR')}, anterior a esta venta: es otro pedido de este cliente`, vivo: true };
    // Los campos que lo dicen (relevados el 20/10/2026 sobre el pedido 628517):
    // `pel_des_usuarionombre` es el paciente y `pel_des_pedinterno` la referencia.
    // Si el portal los renombrara, se cae al barrido de todos los textos.
    const directos = [consulta.pel_des_usuarionombre, consulta.pel_des_pedinterno].filter((v): v is string => typeof v === 'string').map(normalizarReferencia);
    const valores = directos.length ? directos : Object.values(consulta).filter(v => typeof v === 'string').map(v => normalizarReferencia(v as string));
    // El nombre, por palabras y en cualquier orden: el equipo escribe "Devereux Patricia" o "Patricia Devereux".
    const palabras = normalizarReferencia(o.paciente).split(' ').filter(w => w.length >= 3);
    // Un pedido cargado a mano puede llevar el nombre abreviado ("Gimenez Gab" por Gimenez Gabriela, visto el 21/10/2026):
    // cada palabra del paciente tiene que estar entera, o como un token del portal de 3+ letras que sea su comienzo.
    // Vale si el portal trae TODAS las palabras del paciente, o si lo que trae (2+ tokens) son comienzos de palabras del paciente.
    const abreviado = (v: string) => { const t = v.split(' ').filter(x => x.length >= 3); return t.length >= 2 && t.every(x => palabras.some(w => w.startsWith(x))); };
    const nombraPaciente = palabras.length > 0 && valores.some(v => palabras.every(w => v.includes(w)) || abreviado(v));
    const ref = normalizarReferencia(o.pedinterno);
    const nombraRef = !!ref && valores.some(v => v.includes(ref) || (v.length > 6 && ref.includes(v)));
    if (nombraPaciente || nombraRef) return { ok: true, motivo: '', vivo: true };
    return { ok: false, motivo: 'existe y está vivo, pero no nombra a este paciente ni a esta referencia', vivo: true };
}
