import React from "react";

interface Feature {
  icon: string;
  title: string;
  subtitle: string;
}

interface CristalFeaturesProps {
  features: Feature[];
}

export function CristalFeatures({ features }: CristalFeaturesProps) {
  return (
    <div className="w-full bg-black py-4 overflow-hidden border-y border-white/10">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
        {features.map((feature, index) => (
          <React.Fragment key={index}>
            <div className="flex items-center gap-3">
              <span className="text-white text-xl">{feature.icon}</span>
              <div>
                {/* <p>, no <h4>: es la etiqueta de una tira de íconos ("100% UV",
                    "Antirreflejo"…), no una sección del documento. Como h4 caía
                    justo después del <h1> del hero y saltaba dos niveles, en las
                    12 páginas de /cristales-opticos que montan esta tira. */}
                <p className="text-white font-bold text-sm">{feature.title}</p>
                <p className="text-white/60 text-xs mt-0.5">{feature.subtitle}</p>
              </div>
            </div>
            {/* Divider for non-last elements on desktop */}
            {index < features.length - 1 && (
              <div className="hidden md:block w-px h-10 bg-white/20"></div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
