import { Metadata } from 'next';
import { LoginClient } from './LoginClient';

export const metadata: Metadata = {
  title: 'Ingreso al Sistema | Atelier Óptica',
  description: 'Sistema de Gestión y CRM',
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginPage() {
  return <LoginClient />;
}
