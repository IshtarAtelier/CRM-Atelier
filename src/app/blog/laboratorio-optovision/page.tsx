import { notFound } from "next/navigation";
import { NotaMarcaCristal } from "@/components/blog/NotaMarcaCristal";
import { metadataDeNotaMarca, notaMarcaPorSlug } from "@/lib/constants/notas-marcas-cristales";

const SLUG = "laboratorio-optovision";

export const metadata = metadataDeNotaMarca(SLUG);

export default function Page() {
  const nota = notaMarcaPorSlug(SLUG);
  if (!nota) notFound();
  return <NotaMarcaCristal nota={nota} />;
}
