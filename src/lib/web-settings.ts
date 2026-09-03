import { prisma } from './db';
import { WHATSAPP_PHONE } from './constants';
import { CARTEL_PROMO_POR_DEFECTO, TEXTO_CUOTAS_POR_DEFECTO } from './promo-cuotas';

export interface WebSettings {
  web_announcement_text: string;
  web_announcement_active: boolean;
  web_announcement_link: string;
  web_store_address: string;
  web_store_locality: string;
  web_store_maps_url: string;
  web_store_phone: string;
  web_store_whatsapp_id: string;
  web_promo_installments: string;
  web_promo_cash_discount: number;
  // Código del cupón que se muestra en el email de recuperación de carrito
  // abandonado (24hs). Debe ser un código existente en el modelo Coupon; el
  // descuento real (monto/%) sale de esa fila, no de acá. Vacío = email sin cupón.
  web_recovery_coupon_code: string;
  /**
   * 2x1 en ARMAZONES de la tienda web: dos al carrito, se paga el más caro.
   * Es un interruptor y no una constante porque esta promo regala producto
   * —un armazón de la tienda son $136.000— y tiene que poder apagarse desde
   * /admin/web sin esperar un deploy. La regla vive en
   * `src/lib/promo-2x1-armazones.ts`; acá solo se decide si corre.
   * Nada que ver con el 2x1 de multifocales del CRM, que es otra promo.
   */
  web_promo_2x1_frames: boolean;
}

export const defaultWebSettings: WebSettings = {
  // El texto del cartel vive en `promo-cuotas.ts`: estaba escrito tres veces
  // (acá, en StorefrontNavbar y en el form de /admin/web) con tres redacciones
  // distintas, y ninguna aclaraba el costo financiero de las 12 cuotas.
  web_announcement_text: CARTEL_PROMO_POR_DEFECTO,
  web_announcement_active: true,
  web_announcement_link: "/tienda",
  web_store_address: "José Luis de Tejeda 4380",
  web_store_locality: "Cerro de las Rosas, Córdoba",
  web_store_maps_url: "https://www.google.com/maps?cid=14830223812501661125",
  web_store_phone: "+54 9 351 868-5644",
  web_store_whatsapp_id: WHATSAPP_PHONE,
  web_promo_installments: TEXTO_CUOTAS_POR_DEFECTO,
  web_promo_cash_discount: 15,
  web_recovery_coupon_code: "",
  // Apagada por defecto: una promo que regala armazones se prende a propósito,
  // nunca por venir así de fábrica.
  web_promo_2x1_frames: false,
};

export async function getWebSettings(): Promise<WebSettings> {
  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { startsWith: 'web_' }
      }
    });

    const mapped = settings.reduce((acc, curr) => {
      try {
        acc[curr.key] = JSON.parse(curr.value);
      } catch {
        acc[curr.key] = curr.value;
      }
      return acc;
    }, {} as Record<string, any>);

    return {
      ...defaultWebSettings,
      ...mapped
    };
  } catch (error) {
    console.error("Error fetching web settings from database:", error);
    return defaultWebSettings;
  }
}
