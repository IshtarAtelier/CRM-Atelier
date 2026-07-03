import React, { useState } from "react";
import { Tag, Loader2, X, Check } from "lucide-react";

export interface AppliedCoupon {
  code: string;
  discountType: string; // "FIXED" | "PERCENT"
  discountValue: number;
}

/**
 * Campo de código de descuento del checkout. Valida contra el servidor
 * (/api/checkout/validate-coupon) y avisa al padre el cupón aplicado.
 * El monto real siempre lo recalcula el backend al pagar.
 */
export function CouponField({
  subtotal,
  appliedCoupon,
  onApplied,
}: {
  subtotal: number;
  appliedCoupon: AppliedCoupon | null;
  onApplied: (coupon: AppliedCoupon | null) => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyCoupon = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/validate-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed, subtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        onApplied({ code: data.code, discountType: data.discountType, discountValue: data.discountValue });
        setCode("");
      } else {
        setError(data.reason || "Código inválido.");
      }
    } catch {
      setError("No se pudo validar el código. Reintentá.");
    } finally {
      setLoading(false);
    }
  };

  const removeCoupon = () => {
    onApplied(null);
    setError(null);
  };

  if (appliedCoupon) {
    return (
      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 px-4 py-3 my-1">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-black uppercase tracking-widest text-emerald-900">
            Cupón {appliedCoupon.code} aplicado
          </span>
        </div>
        <button
          type="button"
          onClick={removeCoupon}
          className="text-emerald-700 hover:text-emerald-900 transition-colors"
          title="Quitar cupón"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="my-1">
      <div className="flex gap-2">
        <div className="flex items-center gap-2 flex-1 bg-white border border-stone-200 px-3">
          <Tag className="w-4 h-4 text-stone-400 shrink-0" />
          <input
            type="text"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyCoupon();
              }
            }}
            placeholder="Código de descuento"
            className="flex-1 py-3 text-sm uppercase tracking-wide bg-transparent outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-stone-400"
          />
        </div>
        <button
          type="button"
          onClick={applyCoupon}
          disabled={loading || !code.trim()}
          className="px-5 bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-stone-700 transition-colors disabled:opacity-40 flex items-center justify-center min-w-[90px]"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
        </button>
      </div>
      {error && <p className="text-[11px] text-red-600 mt-1.5 font-medium">{error}</p>}
    </div>
  );
}
