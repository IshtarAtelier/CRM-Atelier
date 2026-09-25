"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  medidaCargada,
  medidasCargadas,
  medidasFaltantes,
  type MedidasArmazon as FrameMeasures,
} from "@/lib/medidas-armazon";

interface Props {
  productId: string;
  measures: FrameMeasures;
  editable?: boolean;
  /** Link de WhatsApp para consultar las medidas que no están cargadas. */
  consultaHref?: string;
}

export function GlassesDiagram({ productId, measures: initialMeasures, editable = false, consultaHref }: Props) {
  const [measures, setMeasures] = useState<FrameMeasures>(initialMeasures);
  const [editing, setEditing] = useState<keyof FrameMeasures | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleChange = (field: keyof FrameMeasures, value: string) => {
    const num = value === "" ? null : parseInt(value, 10);
    setMeasures(prev => ({ ...prev, [field]: isNaN(num as number) ? null : num }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/products/${productId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(measures),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
      setEditing(null);
    }
  };

  // Solo lo cargado. Antes cada vacío se completaba con un valor típico
  // (52/18/145, y el alto como calibre × 0,8) y el cliente lo leía como la
  // medida del armazón. Ver `lib/medidas-armazon.ts`.
  const lw = medidaCargada(measures.lensWidth) ? measures.lensWidth : null;
  const bw = medidaCargada(measures.bridgeWidth) ? measures.bridgeWidth : null;
  const fh = medidaCargada(measures.frameHeight) ? measures.frameHeight : null;
  const hayCotas = lw !== null || bw !== null || fh !== null;
  const cargadas = medidasCargadas(measures);
  const faltantes = medidasFaltantes(measures);

  // Render SVG Diagram - Delicate Minimalist Silhouette Style.
  // La silueta es genérica; las cotas se dibujan solo para las medidas cargadas.
  const renderBlueprint = () => (
    <div className="w-full flex flex-col items-center justify-center py-6 opacity-90 mix-blend-multiply dark:mix-blend-normal">
      <svg
        viewBox="0 0 200 80"
        className="w-full max-w-[280px] lg:max-w-[320px] overflow-visible"
        style={{ vectorEffect: "non-scaling-stroke" }}
      >
        <g stroke="currentColor" className="text-stone-800 dark:text-stone-300" strokeWidth="0.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Left Rim - Delicate Panto/Soft Rounded Silhouette */}
          <path d="M 35,24 C 35,21 44,19 60,19 C 76,19 85,21 85,24 C 85,34 83,53 60,53 C 37,53 35,34 35,24 Z" />
          
          {/* Right Rim - Delicate Panto/Soft Rounded Silhouette */}
          <path d="M 115,24 C 115,21 124,19 140,19 C 156,19 165,21 165,24 C 165,34 163,53 140,53 C 117,53 115,34 115,24 Z" />
          
          {/* Delicate Bridge Curve */}
          <path d="M 85,25 C 93,20 107,20 115,25" />
          
          {/* Left Endpiece / Temple Start */}
          <path d="M 35,24 C 32,24 30,25 28,27 L 12,27" />
          
          {/* Right Endpiece / Temple Start */}
          <path d="M 165,24 C 168,24 170,25 172,27 L 188,27" />
        </g>

        {/* Dimension Lines & Labels */}
        <g stroke="#b5b5b5" strokeWidth="0.4" strokeDasharray="1.5 1.5" fill="none">
          {/* Lens Width (35 to 85) */}
          {lw !== null && (
            <>
              <line x1="35" y1="12" x2="85" y2="12" />
              <line x1="35" y1="10" x2="35" y2="16" strokeDasharray="none" />
              <line x1="85" y1="10" x2="85" y2="16" strokeDasharray="none" />
              <text x="60" y="8" textAnchor="middle" fill="currentColor" className="text-stone-500 dark:text-stone-400 font-sans font-medium text-[6px] tracking-wider" stroke="none">{lw}mm</text>
            </>
          )}

          {/* Bridge Width (85 to 115) */}
          {bw !== null && (
            <>
              <line x1="85" y1="36" x2="115" y2="36" />
              <line x1="85" y1="32" x2="85" y2="40" strokeDasharray="none" />
              <line x1="115" y1="32" x2="115" y2="40" strokeDasharray="none" />
              <text x="100" y="44" textAnchor="middle" fill="currentColor" className="text-stone-500 dark:text-stone-400 font-sans font-medium text-[6px] tracking-wider" stroke="none">{bw}mm</text>
            </>
          )}

          {/* Frame Height (19 to 53) */}
          {fh !== null && (
            <>
              <line x1="178" y1="19" x2="178" y2="53" />
              <line x1="174" y1="19" x2="182" y2="19" strokeDasharray="none" />
              <line x1="174" y1="53" x2="182" y2="53" strokeDasharray="none" />
              <text x="186" y="38" textAnchor="start" fill="currentColor" className="text-stone-500 dark:text-stone-400 font-sans font-medium text-[6px] tracking-wider" stroke="none">{fh}mm</text>
            </>
          )}
        </g>
      </svg>
    </div>
  );

  // Editable Form for Admin
  if (editable) {
    return (
      <div className="w-full bg-white p-6 border border-stone-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black">
            Dimensiones Técnicas
          </h3>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-[9px] font-black uppercase tracking-widest bg-black text-white px-4 py-2 hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar Specs"}
          </button>
        </div>

        {renderBlueprint()}

        <div className="grid grid-cols-4 gap-4 mt-4">
          {[
            { id: "lensWidth", label: "LENTE" },
            { id: "bridgeWidth", label: "PUENTE" },
            { id: "templeLength", label: "VARILLA" },
            { id: "frameHeight", label: "ALTO" },
          ].map((field) => (
            <div key={field.id} className="flex flex-col border-b border-stone-200 pb-1">
              <label className="text-[9px] text-stone-400 font-bold tracking-widest uppercase mb-1">{field.label}</label>
              <input
                type="number"
                value={measures[field.id as keyof FrameMeasures] ?? ""}
                placeholder="—"
                onChange={e => handleChange(field.id as keyof FrameMeasures, e.target.value)}
                onFocus={() => setEditing(field.id as keyof FrameMeasures)}
                className="w-full bg-transparent text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none text-black"
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Display Mode for Storefront (High-End Luxury) - Collapsible Accordion
  return (
    <div className="w-full pt-8 pb-4">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center group cursor-pointer border-b border-[#e5e5e5] pb-4"
      >
        {/* h2, no h3: en la ficha de producto este es el primer encabezado
            después del <h1> del modelo, y con h3 el nivel saltaba uno. Este
            componente solo se monta ahí, así que el nivel es seguro. */}
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">
          Medidas y Calce
        </h2>
        <span className="text-xl font-light text-stone-400 group-hover:text-black transition-colors">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      <motion.div
        initial={false}
        animate={{ height: isOpen ? "auto" : 0, opacity: isOpen ? 1 : 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden"
      >
        <div className="pt-6 pb-2">
          {/* Sin ninguna cota, la silueta sola no dice nada: no se dibuja. */}
          {hayCotas && renderBlueprint()}

          {/* Solo las medidas cargadas. Ya no está "Frente": no hay un campo
              con el ancho total, y se calculaba como 2 × lente + puente + 12,
              así que sin medidas decía "12 mm". */}
          {cargadas.length > 0 && (
            <div className="flex flex-col gap-3 text-[11px] font-mono tracking-widest text-black mt-6">
              {cargadas.map(({ campo, etiqueta, mm }, i) => (
                <div
                  key={campo}
                  className={`flex justify-between items-center pb-2 ${i < cargadas.length - 1 ? "border-b border-[#f0f0f0]" : ""}`}
                >
                  <span className="text-stone-500 uppercase font-sans text-[10px] tracking-wider">{etiqueta}</span>
                  <span>{mm} mm</span>
                </div>
              ))}
            </div>
          )}

          {faltantes.length > 0 && (
            <p className={`text-xs text-stone-600 leading-relaxed ${cargadas.length > 0 ? "mt-4" : ""}`}>
              {cargadas.length === 0
                ? "Todavía no tenemos cargadas las medidas de este armazón."
                : `¿Necesitás ${listaDeMedidas(faltantes.map((f) => f.etiqueta.toLowerCase()))}?`}{" "}
              {consultaHref ? (
                <a
                  href={consultaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold text-black underline underline-offset-2 hover:text-stone-600 transition-colors"
                >
                  Consultanos por WhatsApp
                </a>
              ) : (
                "Consultanos."
              )}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/** "el puente" · "el puente o el alto de lente" · "el puente, el largo de patilla o el alto de lente".
 *  Todas las etiquetas de `MEDIDAS_ARMAZON` son masculinas. */
function listaDeMedidas(nombres: string[]): string {
  const conArticulo = nombres.map((n) => `el ${n}`);
  if (conArticulo.length <= 1) return conArticulo.join("");
  return `${conArticulo.slice(0, -1).join(", ")} o ${conArticulo[conArticulo.length - 1]}`;
}
