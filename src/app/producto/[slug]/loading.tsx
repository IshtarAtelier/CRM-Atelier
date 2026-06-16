export default function ProductLoading() {
  return (
    <div className="bg-white min-h-screen pt-20 animate-pulse">
      <div className="max-w-[1600px] mx-auto px-5 py-8 md:py-12">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-16 h-4 bg-stone-200 rounded"></div>
          <div className="w-4 h-4 bg-stone-200 rounded"></div>
          <div className="w-24 h-4 bg-stone-200 rounded"></div>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
          <div className="w-full lg:w-[55%] xl:w-[60%] flex gap-4">
            <div className="hidden md:flex flex-col gap-4 w-24">
              <div className="w-24 h-24 bg-stone-100 rounded-xl"></div>
              <div className="w-24 h-24 bg-stone-100 rounded-xl"></div>
              <div className="w-24 h-24 bg-stone-100 rounded-xl"></div>
            </div>
            <div className="w-full aspect-square bg-stone-100 rounded-2xl"></div>
          </div>
          
          <div className="w-full lg:w-[45%] xl:w-[40%]">
            <div className="w-32 h-6 bg-stone-200 rounded mb-4"></div>
            <div className="w-64 h-10 bg-stone-200 rounded mb-8"></div>
            <div className="w-48 h-8 bg-stone-200 rounded mb-12"></div>
            
            <div className="w-full h-12 bg-stone-100 rounded-xl mb-4"></div>
            <div className="w-full h-12 bg-stone-100 rounded-xl mb-8"></div>
            
            <div className="w-full h-16 bg-stone-900 rounded-2xl mb-8"></div>
            
            <div className="space-y-4">
              <div className="w-full h-24 bg-stone-50 rounded-xl"></div>
              <div className="w-full h-24 bg-stone-50 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
