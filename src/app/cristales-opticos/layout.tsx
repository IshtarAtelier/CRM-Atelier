import { StorefrontNavbar } from "@/components/Storefront/StorefrontNavbar";
import { StorefrontFooter } from "@/components/Storefront/StorefrontFooter";
import { CristalesTabs } from "./CristalesTabs";

export default function CristalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#faf8f5] text-black selection:bg-black selection:text-white overflow-x-hidden font-sans">
      <StorefrontNavbar theme="dark" />
      
      {/* TABS NAVIGATION */}
      <div className="w-full bg-[#faf8f5] pt-28 pb-4 px-6 sticky top-0 z-40 border-b border-[#e8e2db]">
         <div className="max-w-5xl mx-auto overflow-x-auto no-scrollbar">
            <CristalesTabs />
         </div>
      </div>

      <main>
        {children}
      </main>
      
      <StorefrontFooter />
      
    </div>
  );
}
