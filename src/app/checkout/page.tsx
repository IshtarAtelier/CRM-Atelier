import { Metadata } from 'next';
import { CheckoutClient } from './CheckoutClient';

export const metadata: Metadata = {
  title: 'Checkout | Atelier Óptica',
  description: 'Finalizá tu compra de forma segura',
  robots: {
    index: false,
    follow: false,
  },
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
