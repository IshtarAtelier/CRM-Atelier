import React from "react";
import Link from "next/link";

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
        <h2 className="text-3xl font-bold mb-6">{title}</h2>
        <p className="text-lg text-black/70 mb-10 leading-relaxed">
          {description}
        </p>
        <Link 
          href={`/contacto?motivo=${encodeURIComponent(whatsappMotivo)}`}
          className="inline-block bg-[#283f5a] hover:bg-[#1e3047] text-white px-10 py-4 rounded-full font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1"
        >
          {buttonText}
        </Link>
      </div>
    </section>
  );
}
