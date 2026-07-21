import { Metadata } from 'next';
import IngresoMayoristaClient from './IngresoMayoristaClient';

// Puerta de entrada del ÁREA MAYORISTA — separada a propósito del /login del
// CRM interno: otra URL, otro branding (negro/dorado del canal), otro texto.
// Las ópticas nunca deberían ver nada que diga "Sistema de Gestión y CRM".
export const metadata: Metadata = {
  title: 'Ingreso Mayorista | Atelier Óptica',
  description: 'Acceso al portal mayorista de Atelier Óptica para ópticas y distribuidores.',
  robots: { index: false, follow: false },
};

export default function IngresoMayoristaPage() {
  return <IngresoMayoristaClient />;
}
