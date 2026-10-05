import type { Page } from 'playwright';
import { API_BASE, NOMBRE_GRUPO_OPTICO, PORTAL_BASE } from './portal';
import type { Etiquetas } from './robot';

/**
 * LA PANTALLA REAL DEL PORTAL, ANTES DE CREAR EL PEDIDO.
 *
 * Regla de Ishtar (5/10/2026): la revisión muestra SIEMPRE el sistema real del
 * laboratorio, igual en Vitolen que en Grupo Óptico, y desde ahí se da el OK.
 * Vitolen tiene borrador en su portal; SmartLab no (guardar es crear, y la
 * óptica no puede anular). Acá se consigue lo mismo sin crear nada:
 *
 *  1. se abre el editor de pedidos del portal con un nº que no existe;
 *  2. la consulta de ese pedido se contesta DENTRO del navegador con el pedido
 *     que el robot va a mandar (misma forma que devuelve el portal);
 *  3. el portal dibuja SU formulario con SUS listas: esa es la captura;
 *  4. se aprieta "Actualizar pedido" con toda escritura abortada antes de
 *     salir del navegador, para leer qué mandaría el propio portal desde ese
 *     formulario, y se compara con lo que va a mandar el robot. Si difiere en
 *     algo, no hay revisión: no se le muestra a nadie una pantalla que no es
 *     lo que se va a cargar.
 *
 * Comprobado el 5/10/2026 con el pedido real 80549878 servido bajo un nº
 * inexistente: el portal lo dibujó y su payload coincidió campo por campo.
 */

/** Un nº que el portal no tiene (hoy van por 8055xxxx): solo vive dentro del navegador. */
export const NUMERO_DE_VISTA = '99000001';

const dec = (v: unknown): string | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(3) : null;
};

/**
 * El pedido que el robot va a mandar (`payloadCreateUpdate`), con la forma de
 * `data/laboratoryorder/get` (relevada de cinco pedidos reales). Puro.
 */
export function pedidoComoLoGuardaElPortal(p: Record<string, any>, e: Etiquetas, numero = NUMERO_DE_VISTA): Record<string, unknown> {
    const add = (v: unknown) => (Number(v) ? dec(v) : null);
    return {
        clientId: p.clientId, cancellation: '0', clientName: '', clientLastName: '', clientFirstName: '',
        IdPedido: numero, IdCliente: p.clientId,
        FechaRegistro: null, FechaFin: null, FechaFinEstimada: null,
        CodigoOptica: p.opticsCode, IdTipoLente: String(p.lensTypeId),
        OjoDerEsfericoCerca: dec(p.rightEyeNearSpherical), OjoDerCilindricoCerca: null, OjoDerEjeCerca: '0',
        OjoDerEsfericoLejos: dec(p.rightEyeFarSpherical), OjoDerCilindricoLejos: dec(p.rightEyeFarCylindrical), OjoDerEjeLejos: String(p.rightEyeFarAxis ?? '0'),
        OjoIzqEsfericoCerca: dec(p.leftEyeNearSpherical), OjoIzqCilindricoCerca: null, OjoIzqEjeCerca: '0',
        OjoIzqEsfericoLejos: dec(p.leftEyeFarSpherical), OjoIzqCilindricoLejos: dec(p.leftEyeFarCylindrical), OjoIzqEjeLejos: String(p.leftEyeFarAxis ?? '0'),
        CurvaExterna: p.blockBase ?? null,
        IdMaterial: String(p.materialId), IdColor: String(p.colorId), IdPrioridad: '1', Calibrado: '1',
        // En el portal la DNP derecha es "DistInterpupilar" y la izquierda "DistMecanica".
        DistInterpupilar: dec(p.rightEyeInterpupillaryDistance), DistMecanica: dec(p.leftEyeInterpupillaryDistance),
        Altura: null, TrajoCristal: '0', TrajoCristalOI: '0', TrajoArmazon: p.frameBrought ? '1' : '0', TrajoEstuche: '0',
        CristalDeStock: String(p.rightEyeStockArticle ?? '0'), Observacion: p.opticsComment, IdUsuario: null, Stamp: null,
        IdTipoCalibrado: String(p.typeRimId), IdFactura: null, IdSucursal: null, Anulado: '0', UsuarioAnulo: null, Terminal: 'web',
        adicionizq: add(p.leftEyeAddition), adicionder: add(p.rightEyeAddition),
        PaseCristales: '0', NGuia: null, IdTransporte: null, FechaEnvio: null, ObsEnvio: null, EsperaArmazon: '0',
        Diametro: '.0', CristalDeStockOI: String(p.leftEyeStockArticle ?? '0'), EspBorde: null, EspCentro: null, DiametroLab: '0', Pelicula24: '0',
        Armazon: p.frameType, AlturaOI: null,
        A: dec(p.bridgeA), B: dec(p.bridgeB), ED: dec(p.bridgeED), AngED: null, Puente: dec(p.bridge),
        AltPupila: dec(p.rightEyePupillaryHeight), AltPupilaOI: dec(p.leftEyePupillaryHeight),
        PrismaOD: null, PrismaOI: null, EjePrismaOD: null, EjePrismaOI: null, BasePrismaOD: null, BasePrismaOI: null,
        Reclamo: '0', RespetaCurvaExt: '0', RespetaDiametro: '0', RespetaEspCentro: '0', RespetaEspBorde: '0', IdTipoReclamo: null,
        IdMarca: String(p.brandId), ImpresoWeb: null, patient_id: null,
        right_eye_article_id: p.rightEyeArticle, left_eye_article_id: p.leftEyeArticle,
        treatment_id: null, treatment_article_id: null,
        tinted_id: p.tintedId ?? null, tinted_article_id: p.tintedArticleId ?? null, tinted_color: p.tintedColor ?? null,
        tinted_intensity: p.tintedIntensity === null || p.tintedIntensity === undefined ? null : Number(p.tintedIntensity).toFixed(1),
        type_rim_article_id: p.typeRimArticleId, frame_shape: p.frameShape ?? null, frame_model: p.frameModel,
        brand_id: p.brandId, crystal_pass_description: 'NULL', addition_difference: '', sign_difference: '',
        warranty_patient_name: p.warrantyPatientName ?? 'NULL', sector_id: 2,
        right_eye_article_desc: e.articuloOD ?? '', left_eye_article_desc: e.articuloOI ?? '',
    };
}

/**
 * Lo que el formulario del portal decide solo y el robot ADOPTA tal cual (así
 * lo que se muestra es lo que se manda): la base del bloque. Todo lo demás se
 * compara, salvo los datos de transporte de la petición.
 */
export const ADOPTAR_DEL_PORTAL = ['blockBase'] as const;
const DE_TRANSPORTE = new Set(['action', 'orderId', 'isEdit', 'userId', 'isClient', 'clientId', 'patientId', 'sellerId']);

/**
 * Diferencias entre el pedido del robot y el que armó el formulario del
 * portal, en TODAS las claves salvo las de transporte. Los números se comparan
 * como números ("25.000" = "25", "+0.75" = ".750"); solo en ejes y adiciones
 * un 0 vale lo mismo que vacío (un eje sin cilindro, una adición de monofocal).
 * Vacío = iguales. Puro.
 */
export function diferenciasDeVista(robot: Record<string, any>, portal: Record<string, any>): string[] {
    const norm = (k: string, v: unknown): string => {
        if (v === null || v === undefined || v === '' || v === 'NULL') return '';
        if (typeof v === 'boolean') return v ? '1' : '0';
        const t = String(v).trim();
        const n = Number(t);
        if (t !== '' && Number.isFinite(n)) return n === 0 && /Axis$|Addition$/.test(k) ? '' : String(n);
        return t.replace(/\s+/g, ' ');
    };
    const claves = [...new Set([...Object.keys(robot), ...Object.keys(portal)])].filter(k => !DE_TRANSPORTE.has(k));
    return claves.filter(k => norm(k, robot[k]) !== norm(k, portal[k])).map(k => `${k}: el robot manda ${JSON.stringify(robot[k] ?? null)} y el portal armaría ${JSON.stringify(portal[k] ?? null)}`);
}

const SOLO_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Corre `tarea` con el navegador en SOLO LECTURA: toda petición que no sea de
 * lectura, y las de crear/anular del portal, se abortan antes de salir. Antes
 * de entregar el control se COMPRUEBA con una petición de prueba que el
 * bloqueo está puesto; si no, no se sigue.
 */
async function enSoloLectura<T>(page: Page, responder: ((url: string) => unknown | null) | null, tarea: (atajadas: { url: string; body: string | null }[]) => Promise<T>): Promise<T> {
    const atajadas: { url: string; body: string | null }[] = [];
    const handler = async (route: any) => {
        const q = route.request(); const u: string = q.url();
        if (!SOLO_LECTURA.has(q.method()) || /\/(createupdate|cancel|delete|anular)\b/i.test(u)) {
            atajadas.push({ url: u, body: q.postData() });
            return route.abort('blockedbyclient');
        }
        const cuerpo = responder?.(u);
        if (cuerpo) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cuerpo) });
        return route.continue();
    };
    await page.route('**/*', handler);
    try {
        const paso = await page.evaluate(async (u) => {
            try { await fetch(u, { method: 'POST', body: '{}', credentials: 'include' }); return true; } catch { return false; }
        }, `${API_BASE}/__prueba-de-bloqueo`);
        if (paso || !atajadas.some(a => a.url.includes('__prueba-de-bloqueo'))) {
            throw new Error(`${NOMBRE_GRUPO_OPTICO}: no se pudo poner el navegador en solo lectura; no se abre el formulario del portal.`);
        }
        atajadas.length = 0;
        return await tarea(atajadas);
    } finally {
        // Antes de levantar el bloqueo se MATA la página del portal (about:blank):
        // si su JavaScript reintentara el envío abortado, lo haría sin ruta y
        // llegaría al servidor. Con la página en blanco no queda nada corriendo.
        await page.goto('about:blank', { waitUntil: 'commit' }).catch(() => null);
        await page.unroute('**/*', handler).catch(() => null);
    }
}

/** La pantalla del portal hasta su barra de botones (sin el espacio vacío que deja el alto de sobra). */
async function capturaDelFormulario(page: Page): Promise<Buffer> {
    const pie = await page.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find(x => /Actualizar pedido|Guardar pedido/i.test(x.textContent || ''));
        return b ? Math.ceil(b.getBoundingClientRect().bottom + window.scrollY) : 0;
    }).catch(() => 0);
    if (!pie) return page.screenshot({ fullPage: true });
    return page.screenshot({ clip: { x: 0, y: 0, width: 1400, height: Math.min(pie + 48, 3000) } });
}

export interface VistaDelPortal {
    captura: Buffer;
    /** Lo que el propio portal mandaría desde ese formulario (para compararlo). */
    payloadDelPortal: Record<string, any>;
}

/** Abre el formulario real del portal con el pedido que se va a mandar, saca la captura y lee lo que el portal mandaría. NO crea nada. */
export async function capturarVistaEnPortal(page: Page, payload: Record<string, any>, etiquetas: Etiquetas): Promise<VistaDelPortal> {
    const pedido = pedidoComoLoGuardaElPortal(payload, etiquetas);
    return enSoloLectura(page, u => (u.includes(`/data/laboratoryorder/get?id=${NUMERO_DE_VISTA}`) ? pedido : null), async (atajadas) => {
        // Alto de sobra: la barra fija del portal ("Actualizar pedido") queda al pie y no tapa campos.
        await page.setViewportSize({ width: 1400, height: 3000 });
        await page.goto(`${PORTAL_BASE}/smartlab/laboratory/edit/${NUMERO_DE_VISTA}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction((codigo) => (document.querySelector('#optical-code-text') as HTMLInputElement | null)?.value === codigo, payload.opticsCode, { timeout: 120_000 });
        // El formulario pide sus listas (material → color → marca → artículos) en cadena.
        await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => null);
        await page.waitForTimeout(2500);
        const captura = await capturaDelFormulario(page);

        const boton = page.getByRole('button', { name: /Actualizar pedido/i }).first();
        if (await boton.count() === 0) throw new Error(`${NOMBRE_GRUPO_OPTICO}: el formulario del portal no mostró el pedido para revisar.`);
        page.once('dialog', d => { d.dismiss().catch(() => null); });
        await boton.click();
        const limite = Date.now() + 20_000;
        while (Date.now() < limite && !atajadas.some(a => /createupdate/.test(a.url))) await page.waitForTimeout(400);
        const envio = atajadas.find(a => /createupdate/.test(a.url));
        if (!envio?.body) {
            // El portal no llegó a armar el envío: casi siempre abrió un cartel propio diciendo qué le falta.
            const cartel = await page.locator('[role=dialog], .MuiAlert-root, .MuiSnackbar-root').allInnerTexts().catch(() => [] as string[]);
            const dice = cartel.map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean).join(' · ').slice(0, 300);
            throw new Error(`${NOMBRE_GRUPO_OPTICO}: el formulario del portal no aceptó el pedido${dice ? `: "${dice}"` : ' (no dijo por qué)'}. No se creó nada.`);
        }
        return { captura, payloadDelPortal: JSON.parse(envio.body) };
    });
}

/** La pantalla real de un pedido YA creado (solo lectura), para verlo como quedó. */
export async function capturarPedidoCreado(page: Page, numero: string): Promise<Buffer | null> {
    return enSoloLectura(page, null, async () => {
        await page.setViewportSize({ width: 1400, height: 3000 });
        await page.goto(`${PORTAL_BASE}/smartlab/laboratory/edit/${encodeURIComponent(numero)}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => !!(document.querySelector('#optical-code-text') as HTMLInputElement | null)?.value, undefined, { timeout: 120_000 });
        await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => null);
        await page.waitForTimeout(2500);
        return capturaDelFormulario(page);
    }).catch((err) => { console.error('[Grupo Óptico] no se pudo capturar el pedido creado:', err?.message || err); return null; });
}
