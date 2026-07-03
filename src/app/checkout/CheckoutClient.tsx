"use client";

import { useCart } from "@/store/useCart";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { CheckoutContactForm } from "@/components/checkout/CheckoutContactForm";
import { CheckoutShippingForm } from "@/components/checkout/CheckoutShippingForm";
import { CheckoutPaymentOptions } from "@/components/checkout/CheckoutPaymentOptions";
import { CheckoutSummarySidebar } from "@/components/checkout/CheckoutSummarySidebar";
import type { AppliedCoupon } from "@/components/checkout/CouponField";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { trackInitiateCheckout, trackPurchase } from "@/lib/tracking";
import { toast } from "sonner";

export function CheckoutClient({ 
  paywayConfig, 
  initialSettings, 
  footer 
}: { 
  paywayConfig: { publicKey: string; environment: string }; 
  initialSettings?: any; 
  footer?: React.ReactNode 
}) {
  const { items, getCartTotal, clearCart } = useCart();
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [paywayLoaded, setPaywayLoaded] = useState(false);
  const [decidirInstance, setDecidirInstance] = useState<any>(null);
  const [isWholesale, setIsWholesale] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  // Monto del descuento por cupón, calculado sobre el subtotal actual (solo display;
  // el backend lo vuelve a validar y calcular al pagar). No aplica a mayoristas.
  const couponDiscount = (() => {
    if (!appliedCoupon || isWholesale) return 0;
    const subtotal = getCartTotal();
    const raw = appliedCoupon.discountType === 'PERCENT'
      ? Math.round((subtotal * appliedCoupon.discountValue) / 100)
      : Math.round(appliedCoupon.discountValue);
    return Math.max(0, Math.min(raw, Math.round(subtotal)));
  })();

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
    cardType: "CREDIT",
    installments: "1"
  });

  const [webSettings, setWebSettings] = useState<any>({
    web_promo_cash_discount: initialSettings?.web_promo_cash_discount !== undefined ? Number(initialSettings.web_promo_cash_discount) : 15,
    web_promo_installments: initialSettings?.web_promo_installments || "6 cuotas sin interés",
    web_store_whatsapp_id: initialSettings?.web_store_whatsapp_id || WHATSAPP_PHONE
  });

  const whatsappPhoneId = webSettings?.web_store_whatsapp_id || WHATSAPP_PHONE;

  const isLocalCity = (() => {
    const city = (formData.city || "").toLowerCase().trim();
    return city === "cordoba" || 
           city === "córdoba" || 
           city === "cordoba capital" || 
           city === "córdoba capital" || 
           city === "carlos paz" || 
           city === "villa carlos paz";
  })();

  useEffect(() => {
    if (paywayConfig) {
      // Load Decidir SDK immediately on mount using server props
      const script = document.createElement('script');
      script.src = paywayConfig.environment === 'production' 
        ? 'https://live.decidir.com/static/v2/decidir.js'
        : 'https://developers.decidir.com/static/v2/decidir.js';
      script.async = true;
      script.onload = () => {
        setPaywayLoaded(true);
        try {
          const decidirUrl = paywayConfig.environment === 'production' 
            ? 'https://live.decidir.com/api/v2'
            : 'https://developers.decidir.com/api/v2';
          const instance = new (window as any).Decidir(decidirUrl);
          instance.setPublishableKey(paywayConfig.publicKey);
          instance.setTimeout(10000);
          setDecidirInstance(instance);
        } catch (e) {
          console.error("Failed to initialize Decidir on mount:", e);
        }
      };
      document.body.appendChild(script);
    }
  }, [paywayConfig]);

  useEffect(() => {
    let isMounted = true;
    
    const saved = localStorage.getItem("atelier-checkout-form");
    if (saved) {
      try {
        setFormData(JSON.parse(saved));
      } catch (e) {}
    }
    
    // Check if wholesale user is logged in
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        const u = JSON.parse(stored);
        if (u.role === 'OPTICA') {
          if (isMounted) {
            setIsWholesale(true);
            setCurrentUser(u);
            setFormData(prev => ({
              ...prev,
              paymentMethod: 'TRANSFER_MAYORISTA',
              firstName: prev.firstName || u.name || '',
              email: prev.email || u.email || ''
            }));
          }
        }
      } catch (e) {}
    }

    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) return res.json();
        throw new Error();
      })
      .then(data => {
        if (!isMounted) return;
        if (data.role === 'OPTICA') {
          setIsWholesale(true);
          setCurrentUser(data);
          setFormData(prev => ({
            ...prev,
            paymentMethod: 'TRANSFER_MAYORISTA',
            firstName: prev.firstName || data.name || '',
            email: prev.email || data.email || ''
          }));
        } else {
          setIsWholesale(false);
          setCurrentUser(null);
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setIsWholesale(false);
        setCurrentUser(null);
      });

    setMounted(true);
    return () => {
      isMounted = false;
    };
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
    const { name, value } = e.target;
    
    if (name === "zip") {
      const updatedFields: Record<string, string> = {};
      const trimmed = value.trim();
      
      // Auto-fill Córdoba
      if (/^5\d{3}$/.test(trimmed)) {
        updatedFields.state = "Córdoba";
        if (trimmed.startsWith("50")) {
          updatedFields.city = "Córdoba";
        }
      } else if (/^(1\d{3}|[a-zA-Z]1\d{3})$/.test(trimmed)) {
        // Auto-fill CABA
        updatedFields.state = "CABA";
        updatedFields.city = "CABA";
      }
      
      setFormData(prev => ({
        ...prev,
        [name]: value,
        ...updatedFields
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };



  const handlePaywaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    
    try {
      if (formData.paymentMethod === 'TRANSFER' || formData.paymentMethod === 'TRANSFER_MAYORISTA' || formData.paymentMethod === 'ACORDAR_MAYORISTA') {
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
            couponCode: appliedCoupon?.code || null,
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
          toast.error(formData.paymentMethod.includes('MAYORISTA') ? "Error generando pedido mayorista." : "Error generando orden de transferencia.");
        }
        return;
      }

      // PAYWAY LOGIC
      if (!paywayConfig || !(window as any).Decidir) {
        toast.error("La pasarela de pagos aún se está cargando. Por favor intentá en unos segundos.");
        setIsProcessing(false);
        return;
      }

      // Use the mount-initialized instance or fallback to a new one
      let decidir = decidirInstance;
      if (!decidir) {
        try {
          const decidirUrl = paywayConfig.environment === 'production' 
            ? 'https://live.decidir.com/api/v2'
            : 'https://developers.decidir.com/api/v2';
          decidir = new (window as any).Decidir(decidirUrl);
          decidir.setPublishableKey(paywayConfig.publicKey);
          decidir.setTimeout(10000);
        } catch (e) {
          console.error("Error fallback initializing Decidir:", e);
        }
      }

      if (!decidir) {
        toast.error("Error al inicializar la pasarela de pagos. Por favor refrescá la página.");
        setIsProcessing(false);
        return;
      }

      // Limpiar datos
      const cleanedCardNumber = formData.cardNumber.replace(/\D/g, '');
      const [expMonth, expYear] = formData.cardExp.split('/').map(s => s.trim());
      
      if (!cleanedCardNumber || !expMonth || !expYear || !formData.cardCvc || !formData.cardName) {
         toast.error("Por favor completá todos los datos de la tarjeta.");
         setIsProcessing(false);
         return;
      }

      const form = document.createElement('form');
      const createInput = (name: string, value: string) => {
        const input = document.createElement('input');
        input.setAttribute('data-decidir', name);
        input.value = value;
        form.appendChild(input);
      };

      createInput('card_number', cleanedCardNumber);
      createInput('card_expiration_month', expMonth);
      createInput('card_expiration_year', expYear.length === 4 ? expYear.substring(2) : expYear);
      createInput('security_code', formData.cardCvc);
      createInput('card_holder_name', formData.cardName);
      createInput('card_holder_doc_type', 'dni');
      createInput('card_holder_doc_number', formData.dni.replace(/\D/g, ''));

      decidir.createToken(form, async (status: number, response: any) => {
        try {
          if (status !== 200 && status !== 201) {
            console.error("Error Token:", response);
            let tokenErrorMsg = "Los datos de la tarjeta son inválidos o fueron rechazados. Por favor verificá.";
            if (response?.error && Array.isArray(response.error)) {
              const errorDetails = response.error.map((e: any) => e.param || e.message || 'error desconocido').join(', ');
              tokenErrorMsg = `Error en los datos de la tarjeta: ${errorDetails}`;
            }
            toast.error(tokenErrorMsg);
            setIsProcessing(false);
            return;
          }

          const token = response.id;
          const bin = response.bin; // Decidir returns bin in response
          const paymentMethodId = response.payment_method_id; // Decidir returns payment_method_id
          const deviceFingerprint = decidir.device_unique_identifier;

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
              couponCode: appliedCoupon?.code || null,
              paymentToken: token,
              bin: bin,
              paymentMethodId: paymentMethodId,
              deviceUniqueIdentifier: deviceFingerprint
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
              toast.error(data.error || "El pago fue rechazado por la tarjeta.");
            }
          } else {
            const errorData = await res.json();
            toast.error(errorData.error || "Error procesando el pago. Revisá los fondos e intentá de nuevo.");
          }
        } catch (callbackError: any) {
          console.error("Error en callback de PayWay:", callbackError);
          toast.error("Error procesando el pago: " + (callbackError.message || "Intente nuevamente."));
        } finally {
          setIsProcessing(false);
        }
      });

    } catch (error: any) {
      console.error(error);
      toast.error("Error de sistema: " + (error.message || JSON.stringify(error)));
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
              : formData.paymentMethod.includes('MAYORISTA')
                ? "Hemos registrado tu pedido mayorista con éxito. Descontamos el stock de la mercadería."
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
                href={`https://wa.me/${whatsappPhoneId}?text=${encodeURIComponent(`¡Hola! Acabo de realizar una compra web y ya hice la transferencia. Adjunto mi comprobante.`)}`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="block w-full text-center bg-emerald-600 text-white px-6 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-emerald-700 transition-colors"
              >
                Enviar Comprobante por WhatsApp
              </a>
            </div>
          )}

          {(formData.paymentMethod === 'TRANSFER_MAYORISTA' || formData.paymentMethod === 'ACORDAR_MAYORISTA') && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-6 mb-8 text-left animate-in fade-in">
              <h3 className="font-bold text-stone-900 mb-4 text-sm uppercase tracking-widest border-b border-stone-200 pb-2">Pedido Mayorista Registrado</h3>
              <div className="bg-blue-50 text-blue-900 border border-blue-200 rounded p-4 text-xs mb-4">
                <p className="font-bold mb-1">Próximos pasos:</p>
                <p>La mercadería ya fue reservada de nuestro stock. Te enviamos un email de confirmación y en breve nos comunicaremos contigo para enviarte la proforma y coordinar el pago ({formData.paymentMethod === 'TRANSFER_MAYORISTA' ? 'por transferencia' : 'a convenir en dos entregas'}).</p>
              </div>
              <a 
                href={`https://wa.me/${whatsappPhoneId}?text=${encodeURIComponent(`¡Hola! Acabo de registrar un pedido mayorista en la web y me gustaría coordinar el pago.`)}`}
                target="_blank" 
                rel="noopener noreferrer" 
                className="block w-full text-center bg-blue-600 text-white px-6 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors"
              >
                Coordinar Pago por WhatsApp
              </a>
            </div>
          )}

          {formData.paymentMethod !== 'TRANSFER' && !formData.paymentMethod.includes('MAYORISTA') && (
            <div className="bg-green-50 text-green-900 border border-green-200 rounded-lg p-4 mb-8 text-sm">
              <p className="font-medium mb-1">¿Tenés alguna duda con tu pedido?</p>
              <p className="text-green-700/80 mb-2">Escribinos directamente a nuestro canal de soporte.</p>
              <a href={`https://wa.me/${whatsappPhoneId}`} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4 hover:text-green-600 transition-colors">
                Contactar por WhatsApp ({whatsappPhoneId})
              </a>
            </div>
          )}

          <Link href="/tienda" className="inline-block bg-black text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-stone-800 transition-colors">
            Volver a la Tienda
          </Link>
        </div>
        {footer}
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

          <form onSubmit={handlePaywaySubmit}>
            <fieldset disabled={isProcessing} className="flex flex-col gap-10 border-0 p-0 m-0 disabled:opacity-75 transition-opacity">
              <CheckoutContactForm formData={formData} handleChange={handleChange} />
              
              <CheckoutShippingForm formData={formData} handleChange={handleChange} isLocalCity={isLocalCity} hasCrystals={hasCrystals} />
              
              <CheckoutPaymentOptions formData={formData} handleChange={handleChange} isProcessing={isProcessing} webSettings={webSettings} paywayLoaded={paywayLoaded} isWholesale={isWholesale} />
            </fieldset>
          </form>
        </div>

        {/* DERECHA: Resumen de Compra */}
        <CheckoutSummarySidebar
          items={items}
          getCartTotal={getCartTotal}
          formData={formData}
          webSettings={webSettings}
          isWholesale={isWholesale}
          appliedCoupon={appliedCoupon}
          couponDiscount={couponDiscount}
          onCouponApplied={setAppliedCoupon}
        />
      </main>
      
      {footer}
    </div>
  );
}
