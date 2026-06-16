"use client";

import { useState, useRef } from "react";
import { ChevronDown } from "lucide-react";

interface AccordionItemProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export function AccordionItem({ title, subtitle, children, defaultOpen = false }: AccordionItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <div className="border border-[#e8e2db] rounded-2xl bg-white overflow-hidden transition-all duration-300 mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left px-6 py-5 flex items-center justify-between focus:focus:ring-2 focus:ring-amber-500 focus:outline-none hover:bg-[#faf8f5] transition-colors"
      >
        <div>
          <h3 className="text-xl font-bold text-black">{title}</h3>
          {subtitle && <p className="text-sm text-black/60 mt-1">{subtitle}</p>}
        </div>
        <div className={`transform transition-transform duration-300 ${isOpen ? "rotate-180" : "rotate-0"}`}>
          <ChevronDown className="text-black/40 w-6 h-6" />
        </div>
      </button>
      <div
        ref={contentRef}
        className="transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? `${contentRef.current?.scrollHeight}px` : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="px-6 pb-6 pt-2 border-t border-[#e8e2db]/50 text-black/70 leading-relaxed text-[15px]">
          {children}
        </div>
      </div>
    </div>
  );
}
