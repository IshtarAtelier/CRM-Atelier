import { prisma } from './db';
import { WHATSAPP_PHONE } from './constants';

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
}

export const defaultWebSettings: WebSettings = {
  web_announcement_text: "6 Cuotas Sin Interés • 15% OFF en Efectivo o Transferencia • Envío Gratis",
  web_announcement_active: true,
  web_announcement_link: "/tienda",
  web_store_address: "José Luis de Tejeda 4380",
  web_store_locality: "Cerro de las Rosas, Córdoba",
  web_store_maps_url: "https://www.google.com/maps?cid=14830223812501661125",
  web_store_phone: "+54 9 351 868-5644",
  web_store_whatsapp_id: WHATSAPP_PHONE,
  web_promo_installments: "6 cuotas sin interés",
  web_promo_cash_discount: 15,
  web_recovery_coupon_code: "",
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
