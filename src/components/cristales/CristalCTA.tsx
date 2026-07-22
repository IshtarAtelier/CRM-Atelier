import React from "react";
import { buildWhatsAppUrl, currentPageUrl } from "@/lib/whatsapp-link";

interface CristalCTAProps {
  title: string;
  description: React.ReactNode;
  buttonText: string;
  whatsappMotivo: string;
}

export function CristalCTA({ title, description, buttonText, whatsappMotivo }: CristalCTAProps) {
  return (
    <section className="w-full bg-white py-24 px-6 border-t border-[#e8e2db]">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl font-serif text-stone-950 mb-6">{title}</h2>
        <p className="text-lg text-black/70 mb-10 leading-relaxed">
          {description}
        </p>
        <a
          href={buildWhatsAppUrl(whatsappMotivo, { pageUrl: currentPageUrl() })}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-stone-900 hover:bg-[#c8a55c] text-white px-10 py-4 rounded-full font-bold uppercase tracking-widest text-sm transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
        >
          {buttonText}
        </a>
      </div>
    </section>
  );
}
