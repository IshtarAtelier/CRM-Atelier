'use client';

import AnalyticsDashboard from '@/components/admin/analytics/AnalyticsDashboard';

// Wrapper fino: el dashboard vive en components/admin/analytics y también se
// monta como pestaña "Analítica" dentro de /admin/web (pedido del dueño: todo
// lo de la tienda en un solo lugar). Esta ruta queda como acceso directo.
export default function AnaliticaPage() {
  return <AnalyticsDashboard />;
}
