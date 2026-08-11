"use client";

import { useCart } from "@/store/useCart";
import { useWholesaleCartBackfill } from "@/hooks/useIsWholesale";
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { CheckoutContactForm } from "@/components/checkout/CheckoutContactForm";
import { CheckoutShippingForm } from "@/components/checkout/CheckoutShippingForm";
import { CheckoutPaymentOptions } from "@/components/checkout/CheckoutPaymentOptions";
import { CheckoutSummarySidebar } from "@/components/checkout/CheckoutSummarySidebar";
import type { AppliedCoupon } from "@/components/checkout/CouponField";
import { WHATSAPP_PHONE, WHOLESALE_MIN_PIECES } from "@/lib/constants";
import { trackInitiateCheckout, trackPurchase } from "@/lib/tracking";
import { getAdsMatchData, getSessionId, track } from "@/lib/client-analytics";
import { toast } from "sonner";

// Clave de idempotencia del intento de compra: estable entre reintentos (timeout/
// reintento manual) para que el server no cobre dos veces. Se limpia al confirmar.
const IDEM_KEY = "atelier-idempotency-key";
function getIdempotencyKey(): string {
  if (typeof window === "undefined") return "";
  try {
    let k = localStorage.getItem(IDEM_KEY);
    if (!k) {
      k = (crypto?.randomUUID?.() || `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      localStorage.setItem(IDEM_KEY, k);
    }
    return k;
  } catch {
    return `idem-${Date.now()}`;
  }
}
function clearIdempotencyKey() {
  try { localStorage.removeItem(IDEM_KEY); } catch { /* noop */ }
}

export function CheckoutClient({ 
  paywayConfig,
  mercadoPagoEnabled = false,
  initialSettings,
  footer
}: {
  paywayConfig: { publicKey: string; environment: string };
  /** Pasarela de respaldo prendida. Lo resuelve el servidor; acá solo se muestra. */
  mercadoPagoEnabled?: boolean;
  initialSettings?: any;
  footer?: React.ReactNode
}) {
  const { items, getCartTotal, clearCart } = useCart();
  const [mounted, setMounted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  // Qué pedido quedó hecho y por cuánto. Se guarda ANTES de vaciar el carrito:
  // después de clearCart() el total vuelve a cero y la pantalla de éxito no
  // tendría con qué decirle al cliente cuánto transferir.
  const [ordenHecha, setOrdenHecha] = useState<{ id: string | null; total: number } | null>(null);
  const [paywayLoaded, setPaywayLoaded] = useState(false);
  const [decidirInstance, setDecidirInstance] = useState<any>(null);
  const [isWholesale, setIsWholesale] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  // Completa wholesaleBasePrice en ítems agregados antes del login de óptica,
  // para que el resumen muestre lo que el backend efectivamente va a cobrar.
  useWholesaleCartBackfill(isWholesale);

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
  const payLockRef = useRef(false);

  useEffect(() => {
    if (mounted && items.length > 0 && !initiatedRef.current) {
      try {
        trackInitiateCheckout(items, getCartTotal(isWholesale));
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
    birthDate: "",
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

  const [webSettings, setWebSettings] = useState<any>({
    web_promo_cash_discount: initialSettings?.web_promo_cash_discount !== undefined ? Number(initialSettings.web_promo_cash_discount) : 15,
    web_promo_installments: initialSettings?.web_promo_installments || "6 cuotas sin interés",
    web_store_whatsapp_id: initialSettings?.web_store_whatsapp_id || WHATSAPP_PHONE
  });

  const whatsappPhoneId = webSettings?.web_store_whatsapp_id || WHATSAPP_PHONE;

  useEffect(() => {
    if (paywayConfig) {
      // Load Decidir SDK immediately on mount using server props
      const initDecidir = () => {
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

      // Si el SDK ya está en memoria (re-montaje, navegación atrás), no inyectar otro <script>
      if ((window as any).Decidir) {
        initDecidir();
        return;
      }

      const script = document.createElement('script');
      script.src = paywayConfig.environment === 'production'
        ? 'https://live.decidir.com/static/v2/decidir.js'
        : 'https://developers.decidir.com/static/v2/decidir.js';
      script.async = true;
      script.onload = initDecidir;
      document.body.appendChild(script);
    }
  }, [paywayConfig]);

  useEffect(() => {
    let isMounted = true;
    
    const saved = localStorage.getItem("atelier-checkout-form");
    if (saved) {
      try {
        // Se MEZCLA con el estado inicial en vez de reemplazarlo: el borrador
        // guardado en el navegador es de una versión anterior del form y no
        // tiene los campos nuevos. Pisando el objeto entero, cada campo agregado
        // después queda en `undefined` y su input pasa de controlado a no
        // controlado (React lo rompe y avisa en consola).
        setFormData(prev => ({ ...prev, ...JSON.parse(saved) }));
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

    // Verificar sesión SIEMPRE contra /api/auth/me: la cookie de sesión es
    // httpOnly (document.cookie no la ve) y el user de localStorage puede
    // haberse limpiado. En una página transaccional el request extra no importa
    // y evita mostrar precios minoristas a un mayorista logueado.
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

  // ── Vuelta desde Mercado Pago ──
  // Mercado Pago devuelve al comprador con ?mp=aprobado|pendiente|rechazado.
  // Esto es SOLO la pantalla que ve la persona: quien decide si la venta está
  // cobrada es el webhook, que ya corrió del lado del servidor. Por eso acá no
  // se marca nada como pagado, solo se muestra el resultado y se limpia el
  // carrito cuando el pago salió bien.
  const mpVueltaRef = useRef(false);
  useEffect(() => {
    if (!mounted || mpVueltaRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const estado = params.get('mp');
    if (!estado) return;
    mpVueltaRef.current = true;

    const orderId = params.get('mp_order');
    // Sacar los parámetros de la URL: si la persona recarga, no tiene que
    // volver a ver la pantalla de "listo" de una compra que ya pasó.
    window.history.replaceState({}, '', '/checkout');

    if (estado === 'aprobado') {
      setFormData(prev => ({ ...prev, paymentMethod: 'MERCADO_PAGO' }));

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
        // Mismo criterio que las otras ramas: el event_id es el id de la orden,
        // así Meta descarta el duplicado contra el que ya mandó el servidor.
        if (orderId) trackPurchase(orderId, getCartTotal(isWholesale), items);
      } catch (e) {
        console.error("Purchase tracking error:", e);
      }

      // Total en 0 a propósito: al volver de Mercado Pago el cupón aplicado ya
      // no está en memoria, así que cualquier cifra que armemos acá puede ser
      // la equivocada. El importe exacto va en el mail de confirmación, que
      // sale del servidor. Preferimos no decir un número antes que decir uno mal.
      setOrdenHecha({ id: orderId, total: 0 });
      clearCart();
      setIsSuccess(true);
      return;
    }

    if (estado === 'pendiente') {
      toast.info("Tu pago está en proceso. Te avisamos por email en cuanto se acredite.", { duration: 10000 });
      return;
    }

    toast.error("El pago no se completó. Tu carrito sigue acá: podés reintentar o elegir otro medio de pago.", { duration: 10000 });
  }, [mounted]);

  // Si el respaldo se apagó mientras alguien tenía el checkout a medio llenar,
  // su borrador guardado en el navegador sigue diciendo MERCADO_PAGO y al pagar
  // se comería un error del servidor. Se vuelve a tarjeta en silencio.
  useEffect(() => {
    if (!mercadoPagoEnabled && formData.paymentMethod === 'MERCADO_PAGO') {
      setFormData(prev => ({ ...prev, paymentMethod: 'PAYWAY' }));
    }
  }, [mercadoPagoEnabled, formData.paymentMethod]);

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
            total: getCartTotal(isWholesale)
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
              // Etapa del embudo: dejó datos de contacto en el checkout (una vez).
              track('add_contact', { value: getCartTotal(isWholesale) });
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
    // Pedido mayorista: mínimo de piezas (el backend además lo re-valida).
    if (isWholesale) {
      const totalPiezas = items.reduce((acc, i) => acc + i.quantity, 0);
      if (totalPiezas < WHOLESALE_MIN_PIECES) {
        toast.error(`Los pedidos mayoristas requieren un mínimo de ${WHOLESALE_MIN_PIECES} piezas. Tu pedido tiene ${totalPiezas}.`);
        return;
      }
    }
    // Candado anti doble-envío: bloquea reintentos instantáneos aunque React
    // todavía no haya re-renderizado el botón deshabilitado.
    if (payLockRef.current || isProcessing) return;
    payLockRef.current = true;
    // Cooldown de 5s: incluso tras un error, evita ametrallar el botón y duplicar cobros
    setTimeout(() => { payLockRef.current = false; }, 5000);
    setIsProcessing(true);

    try {
      // MERCADO PAGO: se arma el pedido acá y el cobro ocurre en mercadopago.com.
      // Por eso NO se vacía el carrito ni se mide la compra: todavía no hay
      // venta. Si el pago falla o el comprador abandona, vuelve y su carrito
      // sigue intacto para reintentar por otro medio.
      if (formData.paymentMethod === 'MERCADO_PAGO') {
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
            total: getCartTotal(isWholesale),
            couponCode: appliedCoupon?.code || null,
            paymentToken: null,
            analyticsSessionId: getSessionId(),
            adsMatch: getAdsMatchData(),
            idempotencyKey: getIdempotencyKey()
          })
        });

        const data = await res.json().catch(() => ({} as any));

        if (res.ok && data?.redirectUrl) {
          // La clave de idempotencia se rota ANTES de salir del sitio: el pedido
          // ya quedó creado, así que si la persona vuelve y reintenta tiene que
          // ser un intento nuevo y no chocar contra su propia orden anterior.
          // El guard anti doble cobro del backend (mismo total, 2 minutos) sigue
          // cubriendo el reintento apurado.
          clearIdempotencyKey();
          // `replace` y no `href`: así el botón "atrás" del navegador desde
          // Mercado Pago no vuelve a disparar el checkout.
          window.location.replace(data.redirectUrl);
          return;
        }

        if (res.status !== 409) clearIdempotencyKey();
        toast.error(data?.error || "No pudimos abrir el pago con Mercado Pago. Probá con otro medio de pago.");
        return;
      }

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
            total: getCartTotal(isWholesale),
            couponCode: appliedCoupon?.code || null,
            paymentToken: null,
            analyticsSessionId: getSessionId(),
            adsMatch: getAdsMatchData(),
            idempotencyKey: getIdempotencyKey()
          })
        });

        if (res.ok) {
          const data = await res.json().catch(() => ({} as any));
          const sessionId = localStorage.getItem("atelier-checkout-session-id");
          if (sessionId) {
            fetch('/api/checkout/session', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId, status: 'COMPLETED' })
            }).catch(console.error);
            localStorage.removeItem("atelier-checkout-session-id");
          }
          // Siempre, tenga o no session de recuperación: una key ya consumida que
          // sobrevive haría que la PRÓXIMA compra responda "idempotent" sin cobrar.
          clearIdempotencyKey();
          try {
            // SOLO con el id de la orden: el server manda la misma compra por el
            // Conversions API con event_id = order.id, y Meta descarta el
            // duplicado comparando ese id. Mandando acá un uuid al azar (o el id
            // de la sesión de recuperación, que es otra cosa) los dos eventos
            // nunca coincidían y la MISMA venta se contaba dos veces. Si no vino
            // orderId, no se mide del lado del navegador: ya lo cubre el server.
            if (data?.orderId) {
              trackPurchase(data.orderId, getCartTotal(isWholesale), items);
            }
          } catch (e) {
            console.error("Purchase tracking error:", e);
          }
          // Guardar antes de vaciar: clearCart() pone el total en cero.
          setOrdenHecha({ id: data?.orderId ?? null, total: payableTotal });
          clearCart();
          setIsSuccess(true);
        } else {
          // Respuesta terminal del server: rotar la key para que el próximo intento
          // sea un intento nuevo. El 409 (pedido aún procesándose) conserva la key.
          if (res.status !== 409) clearIdempotencyKey();
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
              total: getCartTotal(isWholesale),
              couponCode: appliedCoupon?.code || null,
              paymentToken: token,
              bin: bin,
              paymentMethodId: paymentMethodId,
              deviceUniqueIdentifier: deviceFingerprint,
              analyticsSessionId: getSessionId(),
              adsMatch: getAdsMatchData(),
              idempotencyKey: getIdempotencyKey()
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
              // Siempre, tenga o no session de recuperación: una key ya consumida que
              // sobrevive haría que la PRÓXIMA compra responda "idempotent" sin cobrar.
              clearIdempotencyKey();
              try {
                // Ídem rama transferencia: el transaction_id tiene que ser el id
                // de la orden para que Meta deduplique contra el evento del CAPI.
                if (data?.orderId) {
                  trackPurchase(data.orderId, getCartTotal(isWholesale), items);
                }
              } catch (e) {
                console.error("Purchase tracking error:", e);
              }
              // Guardar antes de vaciar: clearCart() pone el total en cero.
              setOrdenHecha({ id: data?.orderId ?? null, total: payableTotal });
              clearCart();
              setIsSuccess(true);
            } else {
              // Rechazo terminal: rotar la key para que el reintento (otra tarjeta)
              // no choque contra la orden CANCELED que retiene la key vieja.
              clearIdempotencyKey();
              toast.error(data.error || "El pago fue rechazado por la tarjeta.");
            }
          } else {
            const errorData = await res.json();
            // 409 = pedido aún en curso: conservar la key. Cualquier otro error
            // terminal (pago rechazado, validación) rota la key para desbloquear
            // el próximo intento.
            if (res.status !== 409) clearIdempotencyKey();
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

  // Lo que la persona termina pagando. Mismo cálculo que CheckoutSummarySidebar:
  // primero el cupón, después el % por método de pago. Si divergen, el botón
  // miente. Vive acá arriba porque lo usan el botón de pago Y la pantalla de
  // éxito (regla del proyecto: un dato que se muestra en dos lados se arma una
  // sola vez).
  const subtotalConCupon = Math.max(0, getCartTotal(!!isWholesale) - (couponDiscount || 0));
  const payableTotal =
    formData.paymentMethod === 'TRANSFER'
      ? subtotalConCupon * (1 - (webSettings?.web_promo_cash_discount || 15) / 100)
      : subtotalConCupon;

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-between font-sans text-black">
        <StorefrontNavbar theme="light" />
        <main className="text-center mt-32 max-w-md mx-auto px-5 mb-32">
          <ShieldCheck className="w-16 h-16 mx-auto mb-6 text-emerald-500" />
          <h2 className="text-3xl md:text-4xl font-serif text-stone-950 mb-3">¡Gracias por tu compra!</h2>
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

              {/* EL MONTO, arriba de todo. Antes esta pantalla decía "transferí el
                  total con descuento" sin decir cuánto: el cliente quedaba
                  haciendo la cuenta del 15% de memoria, o escribía para
                  preguntar. Es el último paso de una venta ya ganada. */}
              {ordenHecha && ordenHecha.total > 0 && (
                <div className="mb-5 rounded border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-[11px] uppercase tracking-widest text-emerald-800 font-bold mb-1">
                    Importe a transferir
                  </p>
                  <p className="text-3xl font-black text-emerald-900 leading-none">
                    ${Math.round(ordenHecha.total).toLocaleString('es-AR')}
                  </p>
                  <p className="text-[11px] text-emerald-800/80 mt-1.5">
                    Ya tiene aplicado el {webSettings?.web_promo_cash_discount || 15}% de descuento por transferencia.
                  </p>
                </div>
              )}

              <ul className="text-sm text-stone-600 space-y-3 mb-4">
                {ordenHecha?.id && (
                  <li><strong className="text-stone-900">Pedido:</strong> #{ordenHecha.id.slice(-4).toUpperCase()}</li>
                )}
                <li><strong className="text-stone-900">Titular:</strong> Ishtar Pissano</li>
                <li><strong className="text-stone-900">CVU:</strong> 0000069704088281149142</li>
                <li><strong className="text-stone-900">Alias:</strong> atelieroptica.arq</li>
                <li><strong className="text-stone-900">Banco:</strong> Proveedor de Servicios de Pago - Garpa S.A.</li>
              </ul>

              {/* Copiar el alias con un toque: en celular, seleccionar texto de
                  una lista para pegarlo en el homebanking es la friccción que
                  hace que la transferencia quede para después (y no vuelva). */}
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText('atelieroptica.arq')
                    .then(() => toast.success('Alias copiado'))
                    .catch(() => toast.error('No se pudo copiar el alias'));
                }}
                className="w-full mb-4 border border-stone-300 px-6 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-stone-100 transition-colors"
              >
                Copiar alias
              </button>

              <div className="bg-emerald-50 text-emerald-900 border border-emerald-200 rounded p-4 text-xs mb-4">
                <p className="font-bold mb-1">Paso final:</p>
                <p>Transferí el importe y envianos el comprobante con el botón de abajo para que preparemos tu pedido.</p>
              </div>
              <a
                href={`https://wa.me/${whatsappPhoneId}?text=${encodeURIComponent(
                  `¡Hola! Acabo de hacer la compra${ordenHecha?.id ? ` #${ordenHecha.id.slice(-4).toUpperCase()}` : ''}${
                    ordenHecha && ordenHecha.total > 0
                      ? ` por $${Math.round(ordenHecha.total).toLocaleString('es-AR')}`
                      : ''
                  } y ya hice la transferencia. Adjunto mi comprobante.`,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-stone-900 text-white px-6 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-[#c8a55c] transition-colors"
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
                className="block w-full text-center bg-stone-900 text-white px-6 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-[#c8a55c] transition-colors"
              >
                Coordinar Pago por WhatsApp
              </a>
            </div>
          )}

          {formData.paymentMethod !== 'TRANSFER' && !formData.paymentMethod.includes('MAYORISTA') && (
            <div className="bg-green-50 text-green-900 border border-green-200 rounded-lg p-4 mb-8 text-sm">
              <p className="font-medium mb-1">¿Tenés alguna duda con tu pedido?</p>
              <p className="text-green-700/80 mb-2">Escribinos directamente a nuestro canal de soporte.</p>
              <a href={`https://wa.me/${whatsappPhoneId}`} target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4 hover:text-[#8a6d3b] transition-colors">
                Contactar por WhatsApp ({whatsappPhoneId})
              </a>
            </div>
          )}

          <Link href="/tienda" className="inline-block bg-stone-900 text-white px-8 py-4 text-[11px] font-bold uppercase tracking-widest hover:bg-[#c8a55c] transition-colors">
            Volver a la Tienda
          </Link>
        </main>
        {footer}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center font-sans text-black">
        <StorefrontNavbar theme="light" />
        {/* <main> también acá: las tres ramas de este componente se renderizan
            como páginas completas, y el carrito vacío es la que ve cualquiera
            que entre al checkout sin nada cargado (la que mide Lighthouse). */}
        <main className="text-center mt-32">
          <h2 className="text-2xl font-light mb-4">Tu carrito está vacío</h2>
          <Link href="/tienda" className="inline-block bg-stone-900 text-white px-6 py-3 text-[11px] font-bold uppercase tracking-widest hover:bg-[#c8a55c] transition-colors">
            Volver a la Tienda
          </Link>
        </main>
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
            <h1 className="text-3xl md:text-4xl font-serif text-stone-950 mb-2">
              Finalizá tu compra
            </h1>
            <p className="text-stone-500 text-sm">Completá tus datos para finalizar la compra de forma segura.</p>
          </div>

          <form onSubmit={handlePaywaySubmit}>
            <fieldset disabled={isProcessing} className="flex flex-col gap-10 border-0 p-0 m-0 disabled:opacity-75 transition-opacity">
              <CheckoutContactForm formData={formData} handleChange={handleChange} />
              
              <CheckoutShippingForm formData={formData} handleChange={handleChange} hasCrystals={hasCrystals} />
              
              <CheckoutPaymentOptions
                formData={formData}
                handleChange={handleChange}
                isProcessing={isProcessing}
                webSettings={webSettings}
                paywayLoaded={paywayLoaded}
                isWholesale={isWholesale}
                payableTotal={payableTotal}
                mercadoPagoEnabled={mercadoPagoEnabled}
              />
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
