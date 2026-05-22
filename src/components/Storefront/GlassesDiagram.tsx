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
  const fh = measures.frameHeight ?? 42;
  const tl = measures.templeLength ?? 145;

  // Render SVG Diagram - Technical Blueprint Style
  const renderBlueprint = () => (
    <div className="w-full flex flex-col items-center justify-center py-8 opacity-80 mix-blend-multiply">
      <svg
        viewBox="0 0 200 80"
        className="w-full max-w-[280px] lg:max-w-[320px] overflow-visible"
        style={{ vectorEffect: "non-scaling-stroke" }}
      >
        <g stroke="#000" strokeWidth="0.7" fill="none" strokeLinecap="round" strokeLinejoin="round">
          {/* Lenses */}
          <rect x="25" y="20" width="60" height="40" rx="8" />
          <rect x="115" y="20" width="60" height="40" rx="8" />
          
          {/* Bridge */}
          <path d="M 85 30 Q 100 20 115 30" />
          
          {/* Temples (Straight tech line) */}
          <line x1="25" y1="25" x2="-5" y2="25" />
          <line x1="175" y1="25" x2="205" y2="25" />
          
          {/* Hinge details */}
          <circle cx="25" cy="25" r="1.5" fill="#000" />
          <circle cx="175" cy="25" r="1.5" fill="#000" />
        </g>

        {/* Dimension Lines & Labels */}
        <g stroke="#999" strokeWidth="0.5" strokeDasharray="2 2" fill="none">
          {/* Lens Width */}
          <line x1="25" y1="12" x2="85" y2="12" />
          <line x1="25" y1="10" x2="25" y2="18" strokeDasharray="none" />
          <line x1="85" y1="10" x2="85" y2="18" strokeDasharray="none" />
          <text x="55" y="8" textAnchor="middle" fill="#666" fontSize="6" stroke="none" className="font-mono tracking-widest">{lw}mm</text>

          {/* Bridge Width */}
          <line x1="85" y1="35" x2="115" y2="35" />
          <line x1="85" y1="30" x2="85" y2="38" strokeDasharray="none" />
          <line x1="115" y1="30" x2="115" y2="38" strokeDasharray="none" />
          <text x="100" y="44" textAnchor="middle" fill="#666" fontSize="6" stroke="none" className="font-mono tracking-widest">{bw}mm</text>

          {/* Frame Height */}
          <line x1="185" y1="20" x2="185" y2="60" />
          <line x1="180" y1="20" x2="188" y2="20" strokeDasharray="none" />
          <line x1="180" y1="60" x2="188" y2="60" strokeDasharray="none" />
          <text x="192" y="42" textAnchor="start" fill="#666" fontSize="6" stroke="none" className="font-mono tracking-widest">{fh}mm</text>
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
                className="w-full bg-transparent text-sm font-mono focus:outline-none text-black"
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
          Size & Fit
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
              <span className="text-stone-500 uppercase font-sans text-[10px] tracking-wider">Frame Front</span>
              <span>{((measures.lensWidth ?? 0) * 2) + (measures.bridgeWidth ?? 0) + 12} mm</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#f0f0f0] pb-2">
              <span className="text-stone-500 uppercase font-sans text-[10px] tracking-wider">Frame Side</span>
              <span>{measures.templeLength ?? "—"} mm</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#f0f0f0] pb-2">
              <span className="text-stone-500 uppercase font-sans text-[10px] tracking-wider">Lens Width</span>
              <span>{measures.lensWidth ?? "—"} mm</span>
            </div>
            <div className="flex justify-between items-center border-b border-[#f0f0f0] pb-2">
              <span className="text-stone-500 uppercase font-sans text-[10px] tracking-wider">Lens Height</span>
              <span>{measures.frameHeight ?? "—"} mm</span>
            </div>
            <div className="flex justify-between items-center pb-2">
              <span className="text-stone-500 uppercase font-sans text-[10px] tracking-wider">Bridge Width</span>
              <span>{measures.bridgeWidth ?? "—"} mm</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
