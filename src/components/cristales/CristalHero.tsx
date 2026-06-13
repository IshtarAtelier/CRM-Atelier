import React from "react";

interface CristalHeroProps {
  preTitle: string;
  title: string;
  description: React.ReactNode;
}

export function CristalHero({ preTitle, title, description }: CristalHeroProps) {
  return (
    <section className="relative w-full pt-10 pb-20 px-6 md:pt-16 md:pb-28 bg-[#faf8f5]">
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-black/50 mb-6">
          {preTitle}
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-8">
          {title}
        </h1>
        <p className="text-lg md:text-xl text-black/70 max-w-3xl mx-auto leading-relaxed font-light">
          {description}
        </p>
      </div>
    </section>
  );
}
