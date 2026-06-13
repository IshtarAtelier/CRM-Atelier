import { Metadata } from 'next';
import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { FloatingWhatsApp } from "@/components/Storefront/FloatingWhatsApp";
import { MapPin, Clock, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { GoogleReviews } from "@/components/Storefront/GoogleReviews";
import { WHATSAPP_PHONE } from '@/lib/constants';
import { getWebSettings } from '@/lib/web-settings';
import Image from 'next/image';

export const metadata: Metadata = {
  title: "Nuestro Local | Óptica Boutique en Cerro de las Rosas, Córdoba",
  description: "Visitá Atelier Óptica en el corazón del Cerro de las Rosas. Somos especialistas en asesoramiento estético y técnico, cristales multifocales y anteojos de diseño exclusivo.",
  alternates: { canonical: 'https://www.atelieroptica.com.ar/nuestro-local' },
  openGraph: {
    title: "Nuestro Local | Óptica Boutique en Cerro de las Rosas, Córdoba",
    description: "Visitá Atelier Óptica en el corazón del Cerro de las Rosas. Somos especialistas en asesoramiento estético y técnico, cristales multifocales y anteojos de diseño exclusivo.",
    type: "website",
    url: "https://www.atelieroptica.com.ar/nuestro-local",
    images: [
      {
        url: "/images/blog/fachada-ladrillo.webp",
        width: 1200,
        height: 630,
        alt: "Fachada de Atelier Óptica",
      }
    ]
  }
};

export default async function NuestroLocalPage() {
  const settings = await getWebSettings();

  const addressLine = settings.web_store_address;
  const localityLine = settings.web_store_locality;
  const mapsUrl = settings.web_store_maps_url;
  const phone = settings.web_store_phone;
  const whatsappPhoneId = settings.web_store_whatsapp_id;

  const localBusinessJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    'name': 'Atelier Óptica',
    'image': 'https://www.atelieroptica.com.ar/images/og-image.jpg',
    '@id': mapsUrl,
    'url': 'https://www.atelieroptica.com.ar',
    'telephone': phone,
    'priceRange': '$$',
    'address': {
      '@type': 'PostalAddress',
      'streetAddress': addressLine,
      'addressLocality': localityLine,
      'addressRegion': 'Córdoba',
      'postalCode': '5009',
      'addressCountry': 'AR',
    },
    'geo': {
      '@type': 'GeoCoordinates',
      'latitude': -31.3831,
      'longitude': -64.24005,
    },
    'openingHoursSpecification': [
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        'opens': '09:30',
        'closes': '13:00',
      },
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        'opens': '16:30',
        'closes': '20:30',
      },
      {
        '@type': 'OpeningHoursSpecification',
        'dayOfWeek': ['Saturday'],
        'opens': '09:30',
        'closes': '13:00',
      }
    ],
    'aggregateRating': {
      '@type': 'AggregateRating',
      'ratingValue': '5.0',
      'bestRating': '5',
      'worstRating': '1',
      'ratingCount': '89',
    }
  };

  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd) }}
      />
      <StorefrontNavbar theme="light" />

      {/* ── HERO ── */}
      <div className="pt-20 border-b border-stone-100">
        <div className="max-w-[1200px] mx-auto px-5 py-12">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-stone-400 mb-3">Atelier Óptica · Córdoba</p>
          <h1 className="text-4xl md:text-6xl font-light tracking-tight mb-0" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
            Nuestro Local
          </h1>
        </div>
      </div>

      <main className="max-w-[1200px] mx-auto px-5 py-16 pb-24">

        {/* ── FOTOS DEL LOCAL (imágenes del blog que ya existen) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          <div className="md:col-span-2 aspect-video md:aspect-[4/3] lg:aspect-video relative overflow-hidden bg-stone-900 rounded-2xl group">
            <video 
              autoPlay 
              muted 
              loop 
              playsInline
              className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-1000"
              poster="/images/atelier-macro-film.webp"
            >
              <source src="https://cdn.pixabay.com/video/2021/08/04/83863-584742614_large.mp4" type="video/mp4" />
              {/* Nota: Reemplazar el src anterior con "/videos/local-atelier.mp4" cuando tengas tu propio video filmado */}
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent pointer-events-none" />
            <div className="absolute bottom-6 left-6 md:bottom-8 md:left-8 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/70 mb-2">Experiencia Inmersiva</p>
              <p className="text-2xl md:text-3xl font-light" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>Nuestro Espacio</p>
            </div>
          </div>
          <div className="flex flex-col gap-4">
            <div className="aspect-[4/3] md:aspect-auto md:flex-1 relative overflow-hidden bg-stone-100 rounded-2xl group">
              <Image 
                src="/images/blog/mostrador-marmol.webp" 
                alt="Interior Atelier Óptica" 
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700" 
              />
            </div>
            <div className="aspect-[4/3] md:aspect-auto md:flex-1 relative overflow-hidden bg-stone-100 rounded-2xl group">
              <Image 
                src="/images/blog/muestrario-smart-lens.webp" 
                alt="Muestrario Atelier" 
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover group-hover:scale-105 transition-transform duration-700" 
              />
            </div>
          </div>
        </div>

        {/* ── TEXTO SEO ── */}
        <section className="max-w-3xl mb-16">
          <h2 className="text-3xl font-light tracking-tight mb-6" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
            Una Óptica Diferente en Cerro de las Rosas
          </h2>
          <div className="space-y-4 text-stone-600 text-lg leading-relaxed font-light">
            <p>
              Ubicados en el corazón del <strong>Cerro de las Rosas en Córdoba Capital</strong>, en Atelier Óptica fusionamos la precisión técnica de la salud visual con las últimas tendencias del diseño mundial. Entendemos que tus anteojos no son solo una corrección visual, son el accesorio más importante que vestís todos los días.
            </p>
            <p>
              Nos especializamos en brindar un <strong>asesoramiento personalizado (visagismo)</strong> para ayudarte a encontrar el armazón perfecto según la fisionomía de tu rostro y tu estilo personal. Trabajamos con marcas exclusivas y somos expertos en la adaptación de <strong>cristales multifocales</strong> de última tecnología, garantizando una transición visual perfecta.
            </p>
            <p>
              Te invitamos a tomarte un café con nosotros mientras te probás las mejores colecciones de lentes de sol y receta en un ambiente relajado y diseñado para que tu experiencia sea única.
            </p>
          </div>
        </section>

        {/* ── GOOGLE REVIEWS ── */}
        <div className="mb-16 rounded-3xl overflow-hidden border border-stone-100">
          <GoogleReviews />
        </div>

        {/* ── INFO + MAPA ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">
          {/* Info */}
          <div>
            <h2 className="text-2xl font-light tracking-tight mb-8" style={{ fontFamily: "'Georgia', 'Times New Roman', serif" }}>
              Cómo llegar
            </h2>

            <div className="space-y-6 mb-10">
              <div className="flex gap-4">
                <div className="w-10 h-10 border border-stone-200 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-stone-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Dirección</p>
                  <p className="text-sm font-medium text-stone-800">{addressLine}</p>
                  <p className="text-sm text-stone-500">{localityLine}</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 border border-stone-200 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 text-stone-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Horarios</p>
                  <p className="text-sm font-medium text-stone-800">Lunes a Viernes</p>
                  <p className="text-sm text-stone-500">9:00 a 13:30 · 16:00 a 19:30</p>
                  <p className="text-sm font-medium text-stone-800 mt-1">Sábados</p>
                  <p className="text-sm text-stone-500">10:00 a 14:00</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 border border-stone-200 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4 text-stone-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Contacto</p>
                  <p className="text-sm font-medium text-stone-800">{phone}</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={`https://wa.me/${whatsappPhoneId}?text=Hola%20Atelier%2C%20quiero%20hacer%20una%20consulta`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 justify-center px-6 py-3 bg-black text-white text-xs font-black uppercase tracking-widest hover:bg-stone-800 transition-colors"
              >
                <WhatsAppIcon className="w-4 h-4" /> Escribinos
              </a>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 justify-center px-6 py-3 border border-stone-300 text-stone-700 text-xs font-black uppercase tracking-widest hover:border-black hover:text-black transition-colors"
              >
                <MapPin className="w-4 h-4" /> Cómo llegar
              </a>
            </div>
          </div>

          {/* Google Maps embed */}
          <div className="w-full overflow-hidden" style={{ height: 420 }}>
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3406.126442657476!2d-64.2400508!3d-31.3831!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x943299c0da27ea09%3A0xcdd93bb53ab437c5!2sAtelier%20Optica!5e0!3m2!1sen!2sar!4v1716162356789!5m2!1sen!2sar"
              width="100%"
              height="100%"
              style={{ border: 0, filter: "grayscale(80%) contrast(110%)" }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Atelier Óptica - Ubicación"
            />
          </div>
        </div>
      </main>

      <StorefrontFooter />
      <FloatingWhatsApp />
    </div>
  );
}
