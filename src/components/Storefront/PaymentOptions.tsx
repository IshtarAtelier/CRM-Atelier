/**
 * PaymentOptions — Medios de pago de Atelier Óptica
 * Se usa en la página de producto y en la tienda.
 * variant "inline": fila compacta (producto)
 * variant "strip": barra horizontal ancha (tienda, home)
 */

interface PaymentOptionsProps {
  variant?: "inline" | "strip";
}

export function PaymentOptions({ variant = "inline" }: PaymentOptionsProps) {
  const options = [
    {
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
        </svg>
      ),
      label: "6 cuotas",
      sub: "sin interés",
      highlight: false,
    },
    {
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
        </svg>
      ),
      label: "15% OFF",
      sub: "transferencia",
      highlight: true,
    },
  ];

  if (variant === "strip") {
    return (
      <div className="w-full bg-stone-50 border-y border-stone-100 py-4 px-5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-center md:justify-start gap-6">
          <span className="text-[9px] font-black uppercase tracking-[0.25em] text-stone-400 hidden md:block">
            Medios de pago
          </span>
          <div className="w-px h-4 bg-stone-200 hidden md:block" />
          {options.map((opt) => (
            <div key={opt.label} className="flex items-center gap-2">
              <span className={opt.highlight ? "text-black" : "text-stone-400"}>
                {opt.icon}
              </span>
              <div className="flex items-baseline gap-1">
                <span className={`text-[12px] font-black ${opt.highlight ? "text-black" : "text-stone-700"}`}>
                  {opt.label}
                </span>
                <span className="text-[10px] text-stone-400 font-medium">{opt.sub}</span>
              </div>
              <div className="w-px h-3 bg-stone-200 last:hidden" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // variant = "inline" — para la página de producto
  return (
    <div className="w-full border border-[#e5e5e5] divide-y divide-[#e5e5e5] mb-6">
      {options.map((opt) => (
        <div
          key={opt.label}
          className={`flex items-center gap-3 px-4 py-3 ${opt.highlight ? "bg-black text-white" : "bg-white text-black"}`}
        >
          <span className={opt.highlight ? "text-white/70" : "text-stone-400"}>
            {opt.icon}
          </span>
          <div className="flex-1 min-w-0">
            <span className={`text-[12px] font-black tracking-wide ${opt.highlight ? "text-white" : "text-stone-900"}`}>
              {opt.label}
            </span>
            <span className={`text-[11px] ml-1.5 ${opt.highlight ? "text-white/60" : "text-stone-400"}`}>
              {opt.sub}
            </span>
          </div>
          {opt.highlight && (
            <span className="text-[8px] font-black uppercase tracking-widest bg-white text-black px-2 py-0.5">
              Mejor precio
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
