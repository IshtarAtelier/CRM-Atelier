"use client";

/**
 * PaymentOptions — Medios de pago de Atelier Óptica
 * Se usa en la página de producto y en la tienda.
 * variant "inline": fila compacta (producto)
 * variant "strip": barra horizontal ancha (tienda, home)
 */

import { useState, useEffect } from "react";
import { DollarSign } from "lucide-react";

interface PaymentOptionsProps {
  variant?: "inline" | "strip";
  price?: number;
  cashDiscount?: number;
  installmentsText?: string;
}

export function PaymentOptions({ variant = "inline", price, cashDiscount, installmentsText }: PaymentOptionsProps) {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    if (cashDiscount === undefined || installmentsText === undefined) {
      fetch('/api/settings')
        .then(res => res.json())
        .then(data => setSettings(data))
        .catch(err => console.error("Error fetching settings in PaymentOptions:", err));
    }
  }, [cashDiscount, installmentsText]);

  const showCalculated = price && price > 0;
  
  const discountPercent = cashDiscount !== undefined 
    ? cashDiscount 
    : (settings && settings.web_promo_cash_discount !== undefined && !isNaN(Number(settings.web_promo_cash_discount))
        ? Number(settings.web_promo_cash_discount) 
        : 15);

  const instText = installmentsText !== undefined
    ? installmentsText
    : (settings && settings.web_promo_installments ? settings.web_promo_installments : "6 cuotas sin interés");

  const matchInstallments = instText ? instText.match(/\d+/) : null;
  const numInstallments = matchInstallments ? parseInt(matchInstallments[0], 10) : 6;

  const installmentValue = showCalculated ? Math.round(price / numInstallments) : 0;
  const cashPriceValue = showCalculated ? Math.round(price * (1 - discountPercent / 100)) : 0;

  const options = [
    {
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
        </svg>
      ),
      label: showCalculated 
        ? `${instText} de $${installmentValue.toLocaleString('es-AR')}`
        : instText,
      sub: "con tarjetas de crédito",
      highlight: false,
    },
    {
      icon: <DollarSign className="w-4 h-4" strokeWidth={1.5} />,
      label: showCalculated
        ? `$${cashPriceValue.toLocaleString('es-AR')} en efectivo / transferencia`
        : `${discountPercent}% de descuento`,
      sub: showCalculated ? `ahorrás ${discountPercent}% pagando al contado` : "transferencia bancaria o efectivo",
      highlight: true,
    },
  ];

  if (variant === "strip") {
    return (
      <div className="w-full bg-stone-50 border-y border-stone-100 py-4 px-5">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-center md:justify-start gap-6">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-500 hidden md:block">
            Medios de pago
          </span>
          <div className="w-px h-4 bg-stone-200 hidden md:block" />
          {options.map((opt) => (
            <div key={opt.label} className="flex items-center gap-2">
              <span className={opt.highlight ? "text-black" : "text-stone-500"}>
                {opt.icon}
              </span>
              <div className="flex items-baseline gap-1">
                <span className={`text-[12px] font-black ${opt.highlight ? "text-black" : "text-stone-700"}`}>
                  {opt.label}
                </span>
                <span className="text-xs text-stone-500 font-medium">{opt.sub}</span>
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
          <span className={opt.highlight ? "text-[#8a6d3b] dark:text-[#c8a55c]" : "text-stone-500"}>
            {opt.icon}
          </span>
          <div className="flex-1 min-w-0">
            <span className={`text-[12px] font-bold tracking-wide ${opt.highlight ? "text-[#433831] dark:text-[#ebe5df]" : "text-stone-900"}`}>
              {opt.label}
            </span>
            <p className={`text-xs mt-0.5 ${opt.highlight ? "text-stone-500 dark:text-stone-400" : "text-stone-500"}`}>
              {opt.sub}
            </p>
          </div>
          {opt.highlight && (
            <span className="text-[10px] font-black uppercase tracking-widest bg-[#8a6d3b] text-white px-2.5 py-1 rounded-sm shadow-sm">
              Destacado
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
