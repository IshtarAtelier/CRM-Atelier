import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { getWebSettings } from "@/lib/web-settings";
import { BUSINESS_INFO } from "@/lib/business-info";
import { buildOpticianSchema } from "@/lib/schema";
import { getGoogleReviews } from "@/lib/googleReviews";
import { ContactoClient } from "./ContactoClient";

export const revalidate = 300;

export default async function ContactoPage() {
  const settings = await getWebSettings();
  const reviewsData = await getGoogleReviews();

  const whatsappPhoneId = settings?.web_store_whatsapp_id || WHATSAPP_PHONE;
  const phone = settings?.web_store_phone || BUSINESS_INFO.phone;
  const address = settings?.web_store_address || "José Luis de Tejeda 4380";
  const locality = settings?.web_store_locality || "Cerro de las Rosas, Córdoba";
  const mapsUrl = settings?.web_store_maps_url || BUSINESS_INFO.mapsUrl;
  const hours = BUSINESS_INFO.hours;

  const opticianSchema = buildOpticianSchema();
  const contactPageSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "url": "https://atelieroptica.com.ar/contacto",
    "name": `Contacto | ${BUSINESS_INFO.name}`,
    "mainEntity": { "@id": BUSINESS_INFO.entityId },
  };

  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(opticianSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(contactPageSchema) }} />
      <StorefrontNavbar theme="light" />
      <ContactoClient
        whatsappPhoneId={whatsappPhoneId}
        phone={phone}
        address={address}
        locality={locality}
        mapsUrl={mapsUrl}
        hours={hours}
        rating={reviewsData.rating}
        reviewCount={reviewsData.userRatingCount}
      />
      <StorefrontFooter />
    </div>
  );
}

