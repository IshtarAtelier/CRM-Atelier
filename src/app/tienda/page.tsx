import { prisma } from '@/lib/db';
import { TiendaClient } from './TiendaClient';
import { Metadata } from 'next';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Colección de Anteojos | Atelier Óptica',
  description: 'Descubrí nuestra colección completa de anteojos de diseño. Marcos premium seleccionados a mano.',
};

export default async function TiendaPage() {
  const products = await prisma.product.findMany({
      where: {
          publishToWeb: true,
          category: { not: 'Cristal' }
      },
      select: {
          id: true,
          name: true,
          brand: true,
          model: true,
          category: true,
          price: true,
          stock: true,
          imagenesCatalogo: true,
          lensWidth: true,
          bridgeWidth: true,
          templeLength: true,
          frameHeight: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 40
  });

  return <TiendaClient initialProducts={products as any} />;
}
