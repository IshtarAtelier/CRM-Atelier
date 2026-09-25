import Image from "next/image";
import type { Diapositiva } from "@/lib/cristales/smart-lens";

/**
 * Láminas de laboratorio (16:9) en grilla. El texto está DENTRO de la imagen,
 * así que cada una lleva su `alt` completo (ver src/lib/cristales/smart-lens.ts).
 */
export function GaleriaDiapositivas({ diapositivas, columnas = 2, credito }: { diapositivas: Diapositiva[]; columnas?: 1 | 2; credito?: string }) {
  return (
    <figure className="my-10">
      <div className={`grid gap-5 ${columnas === 2 ? "sm:grid-cols-2" : "grid-cols-1"}`}>
        {diapositivas.map((d) => (
          <div key={d.src}>
            <Image
              src={d.src}
              alt={d.alt}
              width={1580}
              height={890}
              sizes={columnas === 2 ? "(min-width: 640px) 448px, 100vw" : "(min-width: 896px) 896px, 100vw"}
              className="w-full h-auto rounded-xl shadow-md"
            />
            {d.pie && <p className="text-sm text-stone-600 mt-2 text-center">{d.pie}</p>}
          </div>
        ))}
      </div>
      {credito && <figcaption className="text-xs text-stone-600 text-center mt-3">{credito}</figcaption>}
    </figure>
  );
}
