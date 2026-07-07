import { Metadata } from 'next';
import { CheckoutClient } from './CheckoutClient';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';
import { prisma } from '@/lib/db';
import { defaultWebSettings } from '@/lib/web-settings';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  alternates: { canonical: '/checkout' },
  title: "Finalizar compra",
  description: 'Finalizá tu compra de forma segura',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CheckoutPage() {
  const paywayConfig = {
    publicKey: process.env.PAYWAY_PUBLIC_KEY || '',
    environment: process.env.PAYWAY_ENVIRONMENT || 'sandbox'
  };

  const webSettings = { ...defaultWebSettings };
  try {
    const dbSettings = await prisma.systemSetting.findMany();
    dbSettings.forEach(s => {
      try {
        (webSettings as any)[s.key] = JSON.parse(s.value);
      } catch {
        (webSettings as any)[s.key] = s.value;
      }
    });
  } catch (e) {
    console.error("Failed to load settings in CheckoutPage server component", e);
  }

  const initialSettings = {
    web_promo_cash_discount: webSettings.web_promo_cash_discount !== undefined ? Number(webSettings.web_promo_cash_discount) : 15,
    web_promo_installments: webSettings.web_promo_installments || "6 cuotas sin interés",
    web_store_whatsapp_id: webSettings.web_store_whatsapp_id || ''
  };

  return (
    <CheckoutClient 
      paywayConfig={paywayConfig} 
      initialSettings={initialSettings} 
      footer={<StorefrontFooter />} 
    />
  );
}
