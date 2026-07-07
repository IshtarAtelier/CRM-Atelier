"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CristalesTabs() {
  const pathname = usePathname();

  const tabGroups = [
    {
      label: "Monofocales",
      tabs: [
        { name: "Eyezen", path: "/cristales-opticos/eyezen" },
        { name: "Super Blue 1.60", path: "/cristales-opticos/super-blue" },
        { name: "Antirreflejo y Blue", path: "/cristales-opticos/antirreflejo" },
        { name: "HD 1.67 Poli", path: "/cristales-opticos/policarbonato" },
      ]
    },
    {
      label: "Multifocales Premium",
      tabs: [
        { name: "Varilux", path: "/cristales-opticos/varilux" },
        { name: "Kodak", path: "/cristales-opticos/kodak" },
      ]
    },
    {
      label: "Control de Miopía Infantil",
      tabs: [
        { name: "MyoFix", path: "/cristales-opticos/myofix" },
        { name: "Stellest", path: "/cristales-opticos/stellest" },
      ]
    },
    {
      label: "Tratamientos y Filtros",
      tabs: [
        { name: "Transitions", path: "/cristales-opticos/transitions" },
        { name: "Blue UV", path: "/cristales-opticos/blue-uv" },
        { name: "Crizal", path: "/cristales-opticos/crizal" },
        { name: "Xperio", path: "/cristales-opticos/xperio" },
      ]
    }
  ];

  return (
    <div className="flex flex-col md:flex-row md:flex-wrap items-start md:items-center gap-x-8 gap-y-6 w-full pb-2 min-w-max">
      {tabGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-black/40 px-2">
            {group.label}
          </span>
          <nav className="flex items-center gap-2">
            {group.tabs.map((tab) => {
              const isActive = pathname === tab.path;
              return (
                <Link
                  key={tab.path}
                  href={tab.path}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    isActive
                      ? "bg-[#283f5a] text-white shadow-md"
                      : "bg-white text-black/60 border border-[#e8e2db] hover:border-black/30 hover:text-black"
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );
}
