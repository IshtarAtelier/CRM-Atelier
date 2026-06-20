import { Metadata } from 'next';
import { CheckoutClient } from './CheckoutClient';
import { StorefrontFooter } from '@/components/Storefront/StorefrontFooter';

export const metadata: Metadata = {
  alternates: { canonical: '/checkout' },
  title: "Checkout",
  description: 'Finalizá tu compra de forma segura',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutPage() {
  return <CheckoutClient footer={<StorefrontFooter />} />;
}
