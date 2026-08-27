import crypto from 'crypto';
import { STORE_ORIGIN } from '@/lib/constants';

/**
 * Mercado Pago — Checkout Pro. Pasarela de RESPALDO del checkout web.
 *
 * Por qué existe: hasta hoy la tienda cobraba con tarjeta por una sola puerta
 * (Payway). Si Payway se cae, se queda sin cobrar por tarjeta y la única salida
 * es la transferencia, que pierde ventas. Esto es el seguro: una segunda puerta,
 * lista y probada, que se abre con una variable de entorno.
 *
 * Por qué Checkout Pro y no un formulario propio: los datos de la tarjeta NUNCA
 * pasan por nuestro servidor. El cliente se va a una URL de mercadopago.com,
 * paga ahí y vuelve. Eso saca de encima toda exigencia PCI y hace que el
 * respaldo no comparta ninguna pieza con el checkout que estamos respaldando
 * —que es justamente lo que uno quiere de un respaldo—. De yapa acepta dinero
 * en cuenta de MP y efectivo (Pago Fácil/Rapipago), que Payway no hace.
 *
 * ÚNICO archivo que habla con la API de Mercado Pago (regla del proyecto: toda
 * integración externa se toca por su service, nunca con un fetch suelto).
 *
 * No usa el SDK oficial a propósito: son tres endpoints REST y el SDK arrastra
 * dependencias y un ciclo de actualizaciones que no queremos en el camino
 * crítico de un cobro.
 */

const MP_API = 'https://api.mercadopago.com';

/** Cuánto esperamos a MP antes de dar el intento por perdido. */
const TIMEOUT_MS = 15000;

/** Estados de un pago en MP que nos importan. El resto se ignora. */
export type MpPaymentStatus =
  | 'approved'     // plata acreditada
  | 'pending'      // esperando (efectivo sin pagar todavía)
  | 'in_process'   // en revisión manual de MP
  | 'rejected'
  | 'cancelled'
  | 'refunded'
  | 'charged_back';

export interface MpPayment {
  id: string;
  status: MpPaymentStatus;
  statusDetail: string | null;
  /** El id de NUESTRA orden. Se manda al crear la preferencia. */
  externalReference: string | null;
  /** Lo efectivamente aprobado, no lo pedido: un pago parcial se ve acá. */
  amount: number;
  paymentMethodId: string | null;
  paymentTypeId: string | null;
  installments: number | null;
  payerEmail: string | null;
  /** Lo que guardamos nosotros al crear la preferencia (ver createPreference). */
  metadata: Record<string, any>;
}

/**
 * ¿Está prendido el respaldo? Se lee de process.env en cada llamada (y no de un
 * módulo cacheado) para que prender la variable en Railway tenga efecto al
 * reiniciar el proceso, sin build ni deploy de código.
 *
 * Exige el token además del flag: un `MP_ENABLED=true` sin credencial mostraría
 * en la tienda un medio de pago que no puede cobrar — el peor de los errores,
 * porque se descubre recién con un cliente con la tarjeta en la mano.
 */
export function isMercadoPagoEnabled(): boolean {
  return process.env.MP_ENABLED === 'true' && !!process.env.MP_ACCESS_TOKEN;
}

function accessToken(): string {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error('MP_ACCESS_TOKEN no configurado.');
  return token;
}

/** true si las credenciales son de prueba (el panel de MP las emite con prefijo TEST-). */
export function isSandbox(): boolean {
  return (process.env.MP_ACCESS_TOKEN || '').startsWith('TEST-');
}

async function mpFetch(path: string, init: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${MP_API}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${accessToken()}`,
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    });

    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      // MP devolvió algo que no es JSON (típico de un 502 del borde). El texto
      // crudo va al mensaje de error porque es lo único que explica qué pasó.
      throw new Error(`Respuesta no-JSON de Mercado Pago (${res.status}): ${text.slice(0, 200)}`);
    }

    if (!res.ok) {
      // `message` + `cause` es la forma en que MP explica los rechazos de la API.
      const detail = data?.message || data?.error || `HTTP ${res.status}`;
      const causes = Array.isArray(data?.cause)
        ? ` [${data.cause.map((c: any) => c.code ?? c.description).join(', ')}]`
        : '';
      throw new Error(`Mercado Pago ${path}: ${detail}${causes}`);
    }

    return data;
  } finally {
    clearTimeout(timer);
  }
}

export interface CreatePreferenceInput {
  /** Id de nuestra orden. Es el hilo que une el pago de MP con la venta del CRM. */
  orderId: string;
  /** Lo que se cobra, en pesos. Debe ser el total ya recalculado en el backend. */
  amount: number;
  description: string;
  payer: {
    firstName: string;
    lastName: string;
    email: string;
    /** Sin +54 ni guiones: MP quiere solo dígitos. */
    phone?: string | null;
  };
  /**
   * Datos de atribución del navegador (fbp/fbc/ip/user-agent/sesión de analítica).
   *
   * Viajan a MP y vuelven en el webhook porque el webhook lo manda un servidor de
   * Mercado Pago, no el navegador del comprador: ahí no hay cookies ni IP del
   * cliente. Sin esto, toda compra por esta puerta llegaría a Meta sin datos de
   * coincidencia y valdría mucho menos para las campañas.
   */
  tracking?: Record<string, string | null | undefined>;
  /** Cuotas a ofrecer en la pantalla de MP (tope y preseleccionada). */
  installments?: { max: number; default?: number } | null;
}

export interface MpPreference {
  id: string;
  /** URL a la que hay que mandar al comprador. */
  initPoint: string;
}

/**
 * Crea la preferencia (la "intención de cobro") y devuelve la URL de pago.
 *
 * `external_reference` = id de nuestra orden: es lo que después permite que el
 * webhook sepa qué venta acreditar. Va también en `metadata.order_id` porque en
 * algunos avisos MP devuelve la metadata y no la referencia.
 *
 * `binary_mode: true` es deliberado: obliga a MP a resolver el pago en aprobado
 * o rechazado, sin el limbo de "in_process" que deja al comprador esperando y a
 * la orden sin acreditar por horas. Un respaldo tiene que dar una respuesta
 * ahora; si hace falta revisión manual, preferimos que rechace y reintente.
 */
export async function createPreference(input: CreatePreferenceInput): Promise<MpPreference> {
  const amount = Math.round(input.amount * 100) / 100;
  if (!(amount > 0)) {
    throw new Error(`Monto inválido para Mercado Pago: ${input.amount}`);
  }

  // La vuelta del comprador cae en el mismo /checkout, que ya sabe mostrar la
  // pantalla de éxito. `mp_order` viaja para poder reconocer la orden aunque MP
  // no agregue sus propios parámetros.
  const backBase = `${STORE_ORIGIN}/checkout`;
  const back = (estado: string) =>
    `${backBase}?mp=${estado}&mp_order=${encodeURIComponent(input.orderId)}`;

  const body = {
    items: [
      {
        id: input.orderId,
        title: input.description.slice(0, 250),
        quantity: 1,
        unit_price: amount,
        currency_id: 'ARS',
      },
    ],
    payer: {
      name: input.payer.firstName,
      surname: input.payer.lastName,
      email: input.payer.email,
      ...(input.payer.phone
        ? { phone: { area_code: '', number: input.payer.phone.replace(/\D/g, '') } }
        : {}),
    },
    // Cuotas: tope (y default) que ve el comprador en la pantalla de MP. Para
    // la opción "12 cuotas (+10%)" el monto YA viene recargado y acá se fija
    // 12/12 para que la pantalla de MP ofrezca exactamente ese plan.
    ...(input.installments
      ? {
          payment_methods: {
            installments: input.installments.max,
            ...(input.installments.default ? { default_installments: input.installments.default } : {}),
          },
        }
      : {}),
    external_reference: input.orderId,
    metadata: {
      order_id: input.orderId,
      ...(input.tracking || {}),
    },
    back_urls: {
      success: back('aprobado'),
      pending: back('pendiente'),
      failure: back('rechazado'),
    },
    auto_return: 'approved',
    binary_mode: true,
    statement_descriptor: 'ATELIER OPTICA',
    notification_url: `${STORE_ORIGIN}/api/webhooks/mercadopago`,
    // Ventana de pago: pasada esa hora la preferencia deja de aceptar plata.
    // Sin esto, alguien podría pagar días después un pedido cuyo stock ya se
    // liberó o cuyo precio cambió, y nos quedaríamos con la obligación.
    expires: true,
    expiration_date_to: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };

  const data = await mpFetch('/checkout/preferences', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  // `init_point` es la URL productiva; `sandbox_init_point` la de prueba. Con
  // credenciales TEST- la productiva rebota, por eso se elige según el token.
  const initPoint = isSandbox()
    ? (data?.sandbox_init_point || data?.init_point)
    : data?.init_point;

  if (!data?.id || !initPoint) {
    throw new Error('Mercado Pago no devolvió init_point para la preferencia.');
  }

  return { id: String(data.id), initPoint: String(initPoint) };
}

function normalizePayment(data: any): MpPayment {
  return {
    id: String(data.id),
    status: data.status,
    statusDetail: data.status_detail ?? null,
    externalReference: data.external_reference ?? data.metadata?.order_id ?? null,
    // `transaction_amount_refunded` no se resta acá a propósito: un reembolso
    // posterior es otro evento del negocio, no un cobro menor.
    amount: Number(data.transaction_details?.total_paid_amount ?? data.transaction_amount ?? 0),
    paymentMethodId: data.payment_method_id ?? null,
    paymentTypeId: data.payment_type_id ?? null,
    installments: data.installments ?? null,
    payerEmail: data.payer?.email ?? null,
    metadata: data.metadata ?? {},
  };
}

/** Consulta un pago por id. Es la ÚNICA fuente de verdad sobre si entró la plata. */
export async function getPayment(paymentId: string): Promise<MpPayment> {
  const data = await mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`);
  return normalizePayment(data);
}

/**
 * Los pagos de una merchant_order.
 *
 * MP manda dos familias de aviso al mismo webhook: `payment` (un pago concreto)
 * y `merchant_order` (el "carrito", que puede tener varios intentos). Sin este
 * segundo camino, un aviso de merchant_order se descartaría y una compra podría
 * quedar cobrada sin acreditar en el CRM.
 */
export async function getMerchantOrderPayments(merchantOrderId: string): Promise<MpPayment[]> {
  const data = await mpFetch(`/merchant_orders/${encodeURIComponent(merchantOrderId)}`);
  const payments = Array.isArray(data?.payments) ? data.payments : [];
  return payments.map((p: any) =>
    normalizePayment({
      ...p,
      external_reference: data?.external_reference ?? null,
      metadata: data?.metadata ?? {},
    }),
  );
}

/**
 * Valida la firma del webhook (header `x-signature`).
 *
 * Sin esto, cualquiera que descubra la URL puede POSTear "el pago 123 se
 * aprobó" y marcar ventas como cobradas. La defensa real es doble: esta firma,
 * y que el estado del pago SIEMPRE se relee de la API de MP en vez de creerle
 * al body — pero la firma es la que frena el ruido antes de gastar una consulta.
 *
 * MP arma el manifiesto `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` y lo
 * firma con HMAC-SHA256 usando la clave secreta del panel. Ojo con el `id`: va
 * en minúsculas y es el del query string (`data.id`), no el del body.
 *
 * Devuelve `false` si falta la firma. Si no hay `MP_WEBHOOK_SECRET` configurado
 * devuelve `null` = "no se puede verificar": quien llama decide, y así el
 * webhook puede funcionar en sandbox antes de que la clave esté cargada sin que
 * eso se convierta en una puerta abierta en producción.
 */
export function verifyWebhookSignature(opts: {
  signatureHeader: string | null;
  requestIdHeader: string | null;
  dataId: string | null;
}): boolean | null {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return null;

  const { signatureHeader, requestIdHeader, dataId } = opts;
  if (!signatureHeader || !dataId) return false;

  // Formato: "ts=1704908010,v1=618c85345248dd820d5fd456117c2ab2ef8eda45a0282ff693eac24131a5e839"
  const parts = Object.fromEntries(
    signatureHeader.split(',').map((p) => {
      const [k, ...rest] = p.split('=');
      return [k.trim(), rest.join('=').trim()];
    }),
  ) as Record<string, string>;

  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestIdHeader || ''};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  // Comparación de tiempo constante: un `===` filtra, por lo que tarda en
  // fallar, cuántos caracteres del principio acertó quien está probando.
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Diagnóstico: confirma que el token sirve y contra qué cuenta pega.
 * Lo usa el chequeo de salud; no lo llama el checkout.
 */
export async function checkCredentials(): Promise<{ ok: boolean; accountId?: string; error?: string }> {
  try {
    const data = await mpFetch('/users/me');
    return { ok: true, accountId: String(data?.id ?? '') };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Error desconocido' };
  }
}
