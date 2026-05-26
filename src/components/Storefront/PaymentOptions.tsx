/**
 * PaymentOptions — Medios de pago de Atelier Óptica
 * Se usa en la página de producto y en la tienda.
 * variant "inline": fila compacta (producto)
 * variant "strip": barra horizontal ancha (tienda, home)
 */

interface PaymentOptionsProps {
  variant?: "inline" | "strip";
  price?: number;
}

export function PaymentOptions({ variant = "inline", price }: PaymentOptionsProps) {
  const showCalculated = price && price > 0;
  
  const installmentValue = showCalculated ? Math.round(price / 6) : 0;
  const cashPriceValue = showCalculated ? Math.round(price * 0.85) : 0;

  const options = [
    {
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
        </svg>
      ),
      label: showCalculated 
        ? `6 cuotas sin interés de $${installmentValue.toLocaleString('es-AR')}`
        : "6 cuotas sin interés",
      sub: "con tarjetas de crédito",
      highlight: false,
    },
    {
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.11Y12m0 0c-.88-.11-1.285-.51-1.285-1.027 0-.522.405-.921.905-.921h1.386c.5 0 .9.4.9.9v1.838M12 6V4m0 14v2m0-14h1.386c.5 0 .9.4.9.9 0 .522-.405.921-.905.921H12M3 16.5h13.5" />
        </svg>
      ),
      label: showCalculated
        ? `$${cashPriceValue.toLocaleString('es-AR')} en efectivo / transferencia`
        : "15% de descuento",
      sub: showCalculated ? "ahorrás 15% pagando al contado" : "transferencia bancaria o efectivo",
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
    <div className="w-full border border-[#e5e5e5] divide-y divide-[#e5e5e5] mb-6 rounded-xl overflow-hidden shadow-sm">
      {options.map((opt) => (
        <div
          key={opt.label}
          className={`flex items-center gap-3 px-4 py-3.5 transition-all duration-300 ${
            opt.highlight 
              ? "bg-[#faf8f5] dark:bg-[#221d1a] border-l-4 border-primary text-[#433831] dark:text-[#ebe5df]" 
              : "bg-white text-black"
          }`}
        >
          <span className={opt.highlight ? "text-primary" : "text-stone-400"}>
            {opt.icon}
          </span>
          <div className="flex-1 min-w-0">
            <span className={`text-[12px] font-bold tracking-wide ${opt.highlight ? "text-primary-800" : "text-stone-900"}`}>
              {opt.label}
            </span>
            <p className={`text-[10px] mt-0.5 ${opt.highlight ? "text-stone-500" : "text-stone-400"}`}>
              {opt.sub}
            </p>
          </div>
          {opt.highlight && (
            <span className="text-[8px] font-black uppercase tracking-widest bg-primary text-white px-2.5 py-1 rounded-sm shadow-sm">
              Destacado
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
