"use client";

import { useCart } from "@/store/useCart";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { CheckoutContactForm } from "@/components/checkout/CheckoutContactForm";
import { CheckoutShippingForm } from "@/components/checkout/CheckoutShippingForm";
import { CheckoutPaymentOptions } from "@/components/checkout/CheckoutPaymentOptions";
import { CheckoutSummarySidebar } from "@/components/checkout/CheckoutSummarySidebar";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { trackInitiateCheckout, trackPurchase } from "@/lib/tracking";

export function CheckoutClient() {
  const { items, getCartTotal, clearCart } = useCart();
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [paywayLoaded, setPaywayLoaded] = useState(false);

  const initiatedRef = useRef(false);

  useEffect(() => {
    if (mounted && items.length > 0 && !initiatedRef.current) {
      try {
        trackInitiateCheckout(items, getCartTotal());
        initiatedRef.current = true;
      } catch (e) {
        console.error("InitiateCheckout tracking error:", e);
      }
    }
  }, [mounted, items]);

  const hasCrystals = items.some(item => item.lensConfig && (item.lensConfig.lensType !== "NONE" || item.lensConfig.color));

  const [formData, setFormData] = useState({
    email: "",
    firstName: "",
    lastName: "",
    dni: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    shippingMethod: "CORREO_DOMICILIO",
    shippingBranch: "",
    paymentMethod: "PAYWAY",
    cardNumber: "",
    cardExp: "",
    cardCvc: "",
    cardName: "",
    installments: "1"
  });

  const [webSettings, setWebSettings] = useState({
    web_promo_cash_discount: 15,
    web_promo_installments: "6 cuotas sin interés"
  });

  const isLocalCity = (() => {
    const city = (formData.city || "").toLowerCase().trim();
    return city === "cordoba" || 
           city === "córdoba" || 
           city === "cordoba capital" || 
           city === "córdoba capital" || 
           city === "carlos paz" || 
           city === "villa carlos paz";
  })();

  const [paywayConfig, setPaywayConfig] = useState<{publicKey: string, environment: string} | null>(null);

  useEffect(() => {
    fetch('/api/checkout/config').then(r => r.json()).then(data => {
      setPaywayConfig(data);
      // Load Decidir SDK
      const script = document.createElement('script');
      script.src = data.environment === 'production' 
        ? 'https://live.decidir.com/static/v2/decidir.js'
        : 'https://developers.decidir.com/static/v2/decidir.js';
      script.async = true;
      script.onload = () => setPaywayLoaded(true);
      document.body.appendChild(script);
    });

    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data) {
          setWebSettings({
            web_promo_cash_discount: data.web_promo_cash_discount !== undefined ? Number(data.web_promo_cash_discount) : 15,
            web_promo_installments: data.web_promo_installments || "6 cuotas sin interés"
          });
        }
      })
      .catch(err => console.error("Error loading web settings in checkout:", err));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("atelier-checkout-form");
    if (saved) {
      try {
        setFormData(JSON.parse(saved));
      } catch (e) {}
    }
    setMounted(true);
  }, []);

  // Auto-adjust shipping method when local/national city transitions
  useEffect(() => {
    if (isLocalCity) {
      if (formData.shippingMethod !== "LOCAL" && formData.shippingMethod !== "CORREO_DOMICILIO" && formData.shippingMethod !== "CORREO_SUCURSAL") {
        setFormData(prev => ({ ...prev, shippingMethod: "LOCAL" }));
      }
    } else {
      if (formData.shippingMethod === "LOCAL") {
        setFormData(prev => ({ ...prev, shippingMethod: "CORREO_DOMICILIO" }));
      }
    }
  }, [isLocalCity, formData.shippingMethod]);

  useEffect(() => {
    if (mounted) {
      const { cardNumber, cardExp, cardCvc, cardName, ...safeFormData } = formData;
      localStorage.setItem("atelier-checkout-form", JSON.stringify(safeFormData));
      
      // Debounce session tracking to avoid spamming the API
      const timeoutId = setTimeout(async () => {
        if (formData.email || formData.phone) {
          const sessionId = localStorage.getItem("atelier-checkout-session-id");
          const payload = {
            sessionId,
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone,
            cartData: items,
            shippingData: {
              address: formData.address,
              city: formData.city,
              state: formData.state,
              zip: formData.zip,
              shippingMethod: formData.shippingMethod,
              shippingBranch: formData.shippingBranch
            },
            total: getCartTotal()
          };

          try {
            const res = await fetch('/api/checkout/session', {
              method: sessionId ? 'PUT' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.sessionId && !sessionId) {
              localStorage.setItem("atelier-checkout-session-id", data.sessionId);
            }
          } catch (e) {
            console.error("Failed to sync checkout session", e);
          }
        }
      }, 2000); // 2 second debounce
      
      return () => clearTimeout(timeoutId);
    }
  }, [formData, mounted, items]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };



  const handlePaywaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      if (formData.paymentMethod === 'TRANSFER') {
        const res = await fetch("/api/checkout/payway", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer: {
              ...formData,
              shippingMethod: formData.shippingMethod,
              shippingBranch: formData.shippingBranch
            },
            items: items,
            total: getCartTotal(),
            paymentToken: null
          })
        });

        if (res.ok) {
          const sessionId = localStorage.getItem("atelier-checkout-session-id");
          if (sessionId) {
            fetch('/api/checkout/session', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId, status: 'COMPLETED' })
            }).catch(console.error);
            localStorage.removeItem("atelier-checkout-session-id");
          }
          try {
            trackPurchase(sessionId || crypto.randomUUID(), getCartTotal(), items);
          } catch (e) {
            console.error("Purchase tracking error:", e);
          }
          clearCart();
          setIsSuccess(true);
        } else {
          alert("Error generando orden de transferencia.");
        }
        return;
      }

      // PAYWAY LOGIC
      if (!paywayConfig || !(window as any).Decidir) {
        alert("La pasarela de pagos aún se está cargando. Por favor intentá en unos segundos.");
        setIsProcessing(false);
        return;
      }

      const decidirUrl = paywayConfig.environment === 'production' 
        ? 'https://live.decidir.com/api/v2'
        : 'https://developers.decidir.com/api/v2';
        
      const decidir = new (window as any).Decidir(decidirUrl);
      decidir.setPublishableKey(paywayConfig.publicKey);
      decidir.setTimeout(10000);

      // Limpiar datos
      const cleanedCardNumber = formData.cardNumber.replace(/\D/g, '');
      const [expMonth, expYear] = formData.cardExp.split('/').map(s => s.trim());
      
      if (!cleanedCardNumber || !expMonth || !expYear || !formData.cardCvc || !formData.cardName) {
         alert("Por favor completá todos los datos de la tarjeta.");
         setIsProcessing(false);
         return;
      }

      const decidirData = {
        card_number: cleanedCardNumber,
        card_expiration_month: expMonth,
        card_expiration_year: expYear.length === 2 ? `20${expYear}` : expYear,
        security_code: formData.cardCvc,
        card_holder_name: formData.cardName,
        card_holder_identification: {
            type: "dni",
            number: formData.dni.replace(/\D/g, '')
        }
      };

      decidir.createToken(decidirData, async (status: number, response: any) => {
        if (status !== 200 && status !== 201) {
          console.error("Error Token:", response);
          alert("Los datos de la tarjeta son inválidos o fueron rechazados. Por favor verificá.");
          setIsProcessing(false);
          return;
        }

        const token = response.id;
        const bin = response.bin; // Decidir returns bin in response

        // Ahora enviamos el token al backend
        const res = await fetch("/api/checkout/payway", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customer: {
              ...formData,
              shippingMethod: formData.shippingMethod,
              shippingBranch: formData.shippingBranch
            },
            items: items,
            total: getCartTotal(),
            paymentToken: token,
            bin: bin
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            const sessionId = localStorage.getItem("atelier-checkout-session-id");
            if (sessionId) {
              fetch('/api/checkout/session', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId, status: 'COMPLETED' })
              }).catch(console.error);
              localStorage.removeItem("atelier-checkout-session-id");
            }
            try {
              trackPurchase(data.orderId || sessionId || crypto.randomUUID(), getCartTotal(), items);
            } catch (e) {
              console.error("Purchase tracking error:", e);
            }
            clearCart();
            setIsSuccess(true);
          } else {
            alert(data.error || "El pago fue rechazado por la tarjeta.");
          }
        } else {
          const errorData = await res.json();
          alert(errorData.error || "Error procesando el pago. Revisá los fondos e intentá de nuevo.");
        }
        setIsProcessing(false);
      });

    } catch (error: any) {
      console.error(error);
      alert("Error de sistema: " + (error.message || JSON.stringify(error)));
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted) return null;

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-between font-sans text-black">
        <StorefrontNavbar theme="light" />
        <div className="text-center mt-32 max-w-md mx-auto px-5 mb-32">
          <ShieldCheck className="w-16 h-16 mx-auto mb-6 text-emerald-500" />
          <h2 className=" font-serif">¡Gracias por tu compra!</h2>
          <p className="text-stone-500 mb-8 leading-relaxed">
            {formData.paymentMethod === 'TRANSFER' 
              ? "Hemos registrado tu pedido con éxito."
              : "Hemos registrado tu pedido de forma exitosa. Te enviamos un correo con la confirmación."}
            <br/><br/>
            <strong>Tiempo de entrega estimado:</strong> {hasCrystals ? '5 días hábiles por trabajo de laboratorio a medida.' : 'Despacho rápido dentro de los 2 días hábiles.'}
          </p>

          {formData.paymentMethod === 'TRANSFER' && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-6 mb-8 text-left">
              <h3 className="font-bold text-stone-900 mb-4 text-sm uppercase tracking-widest border-b border-stone-200 pb-2">Datos para Transferencia</h3>
              <ul className="text-sm text-stone-600 space-y-3 mb-6">
                <li><strong className="text-stone-900">CVU:</strong> 0000069704088281149142</li>
                <li><strong className="text-stone-900">Alias:</strong> badaza.media.arq</li>
                <li><strong className="text-stone-900">Banco:</strong> Proveedor de Servicios de Pago - Garpa S.A.</li>
              </ul>
              <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 rounded p-4 text-xs mb-4">
                <p className="font-bold mb-1">Paso final:</p>
                <p>Transferí el total con descuento y envianos el comprobante haciendo clic en el botón de abajo para que preparemos tu pedido.</p>
              </div>
              <a 
                href={`https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(`¡Hola! Acabo de realizar una compra web y ya hice la transferencia. Adjunto mi comprobante.`)}`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="block w-full text-center bg-emerald-600 text-white px-6 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors"
              >
                Enviar Comprobante por WhatsApp
              </a>
            </div>
          )}

          {formData.paymentMethod !== 'TRANSFER' && (
            <div className="bg-green-50 text-green-900 border border-green-200 rounded-lg p-4 mb-8 text-sm">
              <p className="font-medium mb-1">¿Tenés alguna duda con tu pedido?</p>
              <p className="text-green-700/80 mb-2">Escribinos directamente a nuestro canal de soporte.</p>
              <a href={`https://wa.me/${WHATSAPP_PHONE}`} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4 hover:text-green-600 transition-colors">
                Contactar por WhatsApp ({WHATSAPP_PHONE})
              </a>
            </div>
          )}

          <Link href="/tienda" className="inline-block bg-black text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors">
            Volver a la Tienda
          </Link>
        </div>
        <StorefrontFooter />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center font-sans text-black">
        <StorefrontNavbar theme="light" />
        <div className="text-center mt-32">
          <h2 className="text-2xl font-light mb-4">Tu carrito está vacío</h2>
          <Link href="/tienda" className="inline-block border border-black px-6 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-black hover:text-white transition-colors">
            Volver a la Tienda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      <StorefrontNavbar theme="light" />
      
      <main className="max-w-[1200px] mx-auto px-5 pt-32 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-start">
        
        {/* IZQUIERDA: Formulario de Checkout */}
        <div className="lg:col-span-7 flex flex-col gap-10">
          <div>
            <h1 className=" font-serif">
              Checkout
            </h1>
            <p className="text-stone-500 text-sm">Completá tus datos para finalizar la compra de forma segura.</p>
          </div>

          <form onSubmit={handlePaywaySubmit} className="flex flex-col gap-10">
            
            <CheckoutContactForm formData={formData} handleChange={handleChange} />
            
            <CheckoutShippingForm formData={formData} handleChange={handleChange} isLocalCity={isLocalCity} hasCrystals={hasCrystals} />
            
            <CheckoutPaymentOptions formData={formData} handleChange={handleChange} isProcessing={isProcessing} webSettings={webSettings} paywayLoaded={paywayLoaded} />

          </form>
        </div>

        {/* DERECHA: Resumen de Compra */}
        <CheckoutSummarySidebar items={items} getCartTotal={getCartTotal} formData={formData} webSettings={webSettings} />
      </main>
      
      <StorefrontFooter />
    </div>
  );
}
