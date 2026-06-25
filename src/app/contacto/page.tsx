import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { WHATSAPP_PHONE } from "@/lib/constants";
import { getWebSettings } from "@/lib/web-settings";
import { ContactoClient } from "./ContactoClient";

export const revalidate = 300;

export default async function ContactoPage() {
  const settings = await getWebSettings();

  const whatsappPhoneId = settings?.web_store_whatsapp_id || WHATSAPP_PHONE;
  const phone = settings?.web_store_phone || "+54 9 354 121 5971";
  const locality = settings?.web_store_locality || "Cerro de las Rosas, Córdoba Capital.";

  return (
    <div className="bg-white min-h-screen text-black font-sans selection:bg-black selection:text-white">
      <StorefrontNavbar theme="light" />
      <ContactoClient 
        whatsappPhoneId={whatsappPhoneId} 
        phone={phone} 
        locality={locality} 
      />
      <StorefrontFooter />
      
    </div>
  );
}

