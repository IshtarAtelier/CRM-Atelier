import { prisma } from './db';

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
  // Cupón de recuperación de carrito abandonado (se muestra en el email de las 24hs).
  // El código debe coincidir con el que valida el motor de cupones del checkout.
  web_recovery_coupon_code: string;
  web_recovery_coupon_percent: number;
}

export const defaultWebSettings: WebSettings = {
  web_announcement_text: "6 Cuotas Sin Interés • 15% OFF en Efectivo o Transferencia • Envío Gratis",
  web_announcement_active: true,
  web_announcement_link: "/tienda",
  web_store_address: "José Luis de Tejeda 4380",
  web_store_locality: "Cerro de las Rosas, Córdoba",
  web_store_maps_url: "https://www.google.com/maps?cid=14830223812501661125",
  web_store_phone: "+54 9 354 121 5971",
  web_store_whatsapp_id: "5493541215971",
  web_promo_installments: "6 cuotas sin interés",
  web_promo_cash_discount: 15,
  web_recovery_coupon_code: "",
  web_recovery_coupon_percent: 0,
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
