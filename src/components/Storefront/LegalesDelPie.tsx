import Link from "next/link";
import { BUSINESS_INFO } from "@/lib/business-info";
import {
  RUTA_ARREPENTIMIENTO,
  TEXTO_BOTON_ARREPENTIMIENTO,
  TEXTO_VENTANILLA_FEDERAL,
  URL_VENTANILLA_FEDERAL_RECLAMOS,
} from "@/lib/constants/defensa-consumidor";

/**
 * Lo que una tienda online tiene que mostrar en el pie: botón de
 * arrepentimiento, link a la Ventanilla Federal de reclamos, Data Fiscal y los
 * datos del titular. UN solo componente para StorefrontFooter (home, checkout y
 * casi todo el sitio) y StorefrontFooterStatic (/tienda y /faq), así no
 * divergen (auditoría del 25/9/2026: no estaba en ninguna página).
 *
 * Sin hooks ni datos del servidor: sirve igual dentro de un componente de
 * servidor que de uno de cliente.
 *
 * Antes el pie decía "Comprobante AFIP Data Fiscal" como texto suelto, sin QR
 * ni link: parecía un sello y no lo era. Ahora el link aparece solo cuando
 * `BUSINESS_INFO.dataFiscalUrl` tiene el link real que da ARCA (formulario
 * 960/D). Razón social y CUIT, igual: sin el dato cargado, no se muestran.
 */
export function LegalesDelPie() {
  const { razonSocial, cuit, dataFiscalUrl, address } = BUSINESS_INFO;
  const titular = [razonSocial, cuit ? `CUIT ${cuit}` : null].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-3 md:items-end">
      <div className="flex flex-wrap gap-x-5 gap-y-1 md:justify-end">
        <Link
          href={RUTA_ARREPENTIMIENTO}
          className="text-[13px] font-bold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white min-h-11 md:min-h-0 inline-flex items-center"
        >
          {TEXTO_BOTON_ARREPENTIMIENTO}
        </Link>
        <a
          href={URL_VENTANILLA_FEDERAL_RECLAMOS}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[13px] font-medium text-stone-200 underline decoration-white/30 underline-offset-4 hover:text-white min-h-11 md:min-h-0 inline-flex items-center"
        >
          {TEXTO_VENTANILLA_FEDERAL}
        </a>
        {dataFiscalUrl && (
          <a
            href={dataFiscalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] font-medium text-stone-200 underline decoration-white/30 underline-offset-4 hover:text-white min-h-11 md:min-h-0 inline-flex items-center"
          >
            Data Fiscal
          </a>
        )}
      </div>
      <p className="text-[11px] text-stone-300 md:text-right">
        {titular ? `${titular} · ` : ""}
        {address}
      </p>
    </div>
  );
}
