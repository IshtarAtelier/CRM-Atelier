import React from 'react';

export const Marquee = () => {
  return (
    <div className="w-full bg-black border-y border-white/10 py-3 overflow-hidden">
      <div
        className="flex w-max gap-0"
        style={{ animation: "marquee 30s linear infinite" }}
      >
        {[...Array(2)].map((_, i) => (
          <span key={i} className="flex items-center gap-8 pr-8 text-[11px] font-bold uppercase tracking-[0.25em] text-white/60 whitespace-nowrap">
            <span>Colección de Diseño</span>
            <span className="text-white/20">·</span>
            <span>Acetato Italiano</span>
            <span className="text-white/20">·</span>
            <span>Hechos para destacar tu mirada</span>
            <span className="text-white/20">·</span>
            <span>Curaduría Exclusiva</span>
            <span className="text-white/20">·</span>
          </span>
        ))}
      </div>
    </div>
  );
};
