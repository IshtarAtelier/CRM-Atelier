import { Metadata } from 'next';
import { LoginClient } from './LoginClient';

export const metadata: Metadata = {
  alternates: { canonical: '/login' },
  title: "Ingreso al Sistema",
  description: 'Sistema de Gestión y CRM',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return <LoginClient />;
}
