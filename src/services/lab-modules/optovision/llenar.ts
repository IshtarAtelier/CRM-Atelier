import type { Page } from 'playwright';
import { NOMBRE_OPTOVISION, pedirJsonOves } from './portal';
import type { PlanOves } from './carga';
import { FORMAS_OVES } from './catalogo';

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

    // 1. Lentes (AO / OD / OI).
    await page.check(`#lentes${plan.lentes}`);
    paso('lentes', plan.lentes);

    // 2. Producto: el label exacto; la app busca `exact=` al cambiar y, si da uno solo, llena el hidden y carga servicios.
    await jq(`$('#lineaRX').val(a).trigger('change');`, plan.producto.label);
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
    const inhabilitados = new Set(reglas.inhabilitados);
    const noAplican: string[] = [];
    const escribir = async (id: string, valor: string | null) => {
        if (valor === null || valor === '') return;
        if (inhabilitados.has(id)) { noAplican.push(id); return; }
        const el = page.locator(`#${id}`);
        if (await el.count() === 0) throw new Error(`${NOMBRE_OPTOVISION}: el formulario no tiene el campo ${id}`);
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
    const mensaje = (await page.locator('#mensajeRX').innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (mensaje && mensaje !== '.') throw new Error(`${NOMBRE_OPTOVISION}: el formulario marca un problema: "${mensaje}". No se mandó nada.`);
    const vacios: string[] = [];
    for (const id of reglas.obligatorios) {
        const el = page.locator(`#${id}`);
        if (await el.count() === 0) continue;
        const visible = await el.isVisible().catch(() => false);
        if (!visible) continue;
        const v = (await el.inputValue().catch(() => '')).trim();
        if (!v) vacios.push(id);
    }
    if (vacios.length) throw new Error(`${NOMBRE_OPTOVISION}: el portal exige ${vacios.join(', ')} para este producto y la venta no lo tiene. No se mandó nada.`);

    return { pasos, formulario: await leerFormulario(page), noAplican, reglas };
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
    let alerta: string | null = null;
    let confirmado = false;
    // La barrera corre ADENTRO del handler del dialog (el único momento entre el
    // clic y el confirm): si falla, el confirm se rechaza y la falla se guarda
    // acá para lanzarla desde el flujo principal — un throw dentro del handler
    // se perdería en el emitter y el robot esperaría 10 minutos en vano.
    let fallaBarrera: unknown = null;
    const onDialog = async (d: any) => {
        if (d.type() === 'confirm') {
            try { await opts.antesDeConfirmar?.(); } catch (err) { fallaBarrera = err; await d.dismiss().catch(() => null); return; }
            confirmado = true;
            await d.accept().catch(() => null);
        } else {
            alerta = d.message();
            await d.accept().catch(() => null);
        }
    };
    page.on('dialog', onDialog);
    try {
        await page.locator('#grabar').first().click();
        const limite = Date.now() + 10 * 60_000;
        while (Date.now() < limite) {
            await page.waitForTimeout(1000);
            if (fallaBarrera) throw fallaBarrera;
            if (alerta) break;
            const ahora = (await page.locator('#bottomcontent').innerHTML().catch(() => '')) || '';
            if (ahora && ahora !== antes && !/<form/i.test(ahora.slice(0, 200))) {
                const texto = ahora.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                if (/error interno|se produjo un error/i.test(texto)) throw new PortalRespondioError(`${NOMBRE_OPTOVISION} respondió con error al grabar: ${texto.slice(0, 300)}`);
                const numero = numeroDeLaRespuesta(ahora, opts.excluir ?? []);
                if (!numero) throw new PortalRespondioError(`${NOMBRE_OPTOVISION} grabó pero no se pudo leer UN nº de pedido en la respuesta: ${texto.slice(0, 300)}`);
                return { numero, respuesta: texto.slice(0, 2000) };
            }
        }
        if (alerta) throw new PedidoRechazadoError(`el portal no aceptó el pedido: ${alerta}`);
        if (!confirmado) throw new PedidoRechazadoError('el portal no pidió confirmar el pedido (faltan datos obligatorios o hay un mensaje pendiente): no se grabó nada');
        throw new PortalRespondioError(`${NOMBRE_OPTOVISION} no respondió al grabar en 10 minutos: no se sabe si lo tomó`);
    } finally {
        page.off('dialog', onDialog);
    }
}

/**
 * Busca en el listado del portal un pedido por su "Referencia Cliente" (el
 * `#XXXX Nombre N°par` del plan). Devuelve los nº web que la tienen, del más
 * nuevo al más viejo. Solo lee.
 */
export async function buscarPorReferencia(page: Page, referencia: string): Promise<{ numero: string; estado: string; referencia: string }[]> {
    await page.locator('#historialrx_a').first().click();
    await esperarQueTermineDeActualizar(page);
    await page.locator('#side-menu li#BU a').first().waitFor({ state: 'visible' });
    await page.locator('#side-menu li#BU a').first().click();
    await page.waitForSelector('#bus_refped_int', { state: 'visible' });
    await page.fill('#bus_refped_int', referencia.slice(0, 30));
    await page.locator('#buscar_rx').click();
    await esperarQueTermineDeActualizar(page);
    await page.waitForSelector('#listapedidos', { state: 'attached' });
    await page.waitForTimeout(1500);
    const filas: { numero: string; estado: string; referencia: string }[] = await page.evaluate(() => {
        const out: { numero: string; estado: string; referencia: string }[] = [];
        for (const tr of Array.from(document.querySelectorAll('#listapedidos tbody tr'))) {
            const celdas = Array.from(tr.querySelectorAll('th, td')).map(c => (c as HTMLElement).innerText.trim());
            if (celdas.length < 5 || !/^\d{6}$/.test(celdas[0])) continue;
            out.push({ numero: celdas[0], estado: celdas[2], referencia: celdas[4] });
        }
        return out;
    });
    return filas.filter(f => f.referencia.replace(/\s+/g, ' ').toLowerCase() === referencia.replace(/\s+/g, ' ').toLowerCase());
}
