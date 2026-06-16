const fs = require('fs');
let c = fs.readFileSync('src/app/admin/facturacion/page.tsx', 'utf8');
c = c.replace(/<div className="flex bg-stone-100/g, '<div role="tablist" aria-label="Filtros de facturación" className="flex bg-stone-100');
c = c.replace(/<button[ \n]*onClick={\(\) => setActiveTab\('pending'\)}/g, '<button role="tab" aria-selected={activeTab === \'pending\'} id="tab-pending"\n                            onClick={() => setActiveTab(\'pending\')}');
c = c.replace(/<button[ \n]*onClick={\(\) => setActiveTab\('completed'\)}/g, '<button role="tab" aria-selected={activeTab === \'completed\'} id="tab-completed"\n                            onClick={() => setActiveTab(\'completed\')}');
c = c.replace(/<button[ \n]*onClick={\(\) => setActiveTab\('unbilled'\)}/g, '<button role="tab" aria-selected={activeTab === \'unbilled\'} id="tab-unbilled"\n                            onClick={() => setActiveTab(\'unbilled\')}');

fs.writeFileSync('src/app/admin/facturacion/page.tsx', c);
console.log('Tabs fixed');
