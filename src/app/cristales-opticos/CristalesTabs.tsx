"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CristalesTabs() {
  const pathname = usePathname();

  const tabs = [
    { name: "Varilux", path: "/cristales-opticos/varilux" },
    { name: "Xperio", path: "/cristales-opticos/xperio" },
    { name: "Crizal", path: "/cristales-opticos/crizal" },
    { name: "Transitions", path: "/cristales-opticos/transitions" },
    { name: "Blue UV", path: "/cristales-opticos/blue-uv" },
    { name: "Stellest", path: "/cristales-opticos/stellest" },
  ];

  return (
    <nav className="flex items-center gap-2 md:gap-4 whitespace-nowrap pb-2">
      {tabs.map((tab) => {
        const isActive = pathname === tab.path;
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
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
  );
}
