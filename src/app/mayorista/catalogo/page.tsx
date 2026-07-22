import { redirect } from 'next/navigation';

// La ruta del catálogo pasó a /capsulaescarlata (link más corto y con la marca
// del canal). Esta queda como redirect permanente porque ya se mandaron links
// con la URL vieja por WhatsApp: siguen funcionando, con su ?lead= intacto.
export default async function CatalogoMayoristaLegacyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const lead = typeof params.lead === 'string' ? params.lead : null;
  redirect(lead ? `/capsulaescarlata?lead=${encodeURIComponent(lead)}` : '/capsulaescarlata');
}
