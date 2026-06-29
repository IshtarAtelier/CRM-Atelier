"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface FrameMeasures {
  lensWidth: number | null;
  bridgeWidth: number | null;
  templeLength: number | null;
  frameHeight: number | null;
}

interface Props {
  productId: string;
  measures: FrameMeasures;
  editable?: boolean;
}

export function GlassesDiagram({ productId, measures: initialMeasures, editable = false }: Props) {
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

  const lw = measures.lensWidth ?? 52;
  const bw = measures.bridgeWidth ?? 18;
  const fh = measures.frameHeight ?? Math.round(lw * 0.8);
  const tl = measures.templeLength ?? 145;

  // Render SVG Diagram - Delicate Minimalist Silhouette Style
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
          <line x1="35" y1="12" x2="85" y2="12" />
          <line x1="35" y1="10" x2="35" y2="16" strokeDasharray="none" />
          <line x1="85" y1="10" x2="85" y2="16" strokeDasharray="none" />
          <text x="60" y="8" textAnchor="middle" fill="currentColor" className="text-stone-500 dark:text-stone-400 font-sans font-medium text-[6px] tracking-wider" stroke="none">{lw}mm</text>

          {/* Bridge Width (85 to 115) */}
          <line x1="85" y1="36" x2="115" y2="36" />
          <line x1="85" y1="32" x2="85" y2="40" strokeDasharray="none" />
          <line x1="115" y1="32" x2="115" y2="40" strokeDasharray="none" />
          <text x="100" y="44" textAnchor="middle" fill="currentColor" className="text-stone-500 dark:text-stone-400 font-sans font-medium text-[6px] tracking-wider" stroke="none">{bw}mm</text>

          {/* Frame Height (19 to 53) */}
          <line x1="178" y1="19" x2="178" y2="53" />
          <line x1="174" y1="19" x2="182" y2="19" strokeDasharray="none" />
          <line x1="174" y1="53" x2="182" y2="53" strokeDasharray="none" />
          <text x="186" y="38" textAnchor="start" fill="currentColor" className="text-stone-500 dark:text-stone-400 font-sans font-medium text-[6px] tracking-wider" stroke="none">{fh}mm</text>
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
                className="w-full bg-transparent text-sm font-mono focus:focus:ring-2 focus:ring-amber-500 focus:outline-none text-black"
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
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-black">
          Medidas y Calce
        </h3>
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
          {renderBlueprint()}
          
          <div className="flex flex-col gap-3 text-[11px] font-mono tracking-widest text-black mt-6">
            <div className="flex justify-between items-center border-b border-[#f0f0f0] pb-2">
              <span className="text-stone-500 uppercase font-sans text-[10px] tracking-wider">Frente</span>
              <span>{((measures.lensWidth ?? 0) * 2) + (measures.bridgeWidth ?? 0) + 12} mm</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#f0f0f0] pb-2">
              <span className="text-stone-500 uppercase font-sans text-[10px] tracking-wider">Largo de patilla</span>
              <span>{measures.templeLength ?? "—"} mm</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#f0f0f0] pb-2">
              <span className="text-stone-500 uppercase font-sans text-[10px] tracking-wider">Ancho de lente</span>
              <span>{measures.lensWidth ?? "—"} mm</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#f0f0f0] pb-2">
              <span className="text-stone-500 uppercase font-sans text-[10px] tracking-wider">Alto de lente</span>
              <span>{measures.frameHeight ?? Math.round(lw * 0.8)} mm</span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <span className="text-stone-500 uppercase font-sans text-[10px] tracking-wider">Puente</span>
              <span>{measures.bridgeWidth ?? "—"} mm</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
