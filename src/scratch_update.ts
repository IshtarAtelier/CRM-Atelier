import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway"
});

function autoCorrectBrand(brand: string | null | undefined): string | null {
    if (!brand) return null;
    let b = brand.trim();
    if (!b) return null;
    
    const lower = b.toLowerCase();
    
    if (lower === 'hango loose' || lower === 'hangoloose') return 'Hang Loose';
    if (lower === 'hanoveer kids' || lower === 'hannover kid') return 'Hannover Kids';
    if (lower === 'kazwini') return 'Kazwini';
    if (lower === 'varilux') return 'Varilux';
    if (lower === 'grupo optico' || lower === 'grupo óptico') return 'Grupo Optico';
    if (lower === 'smart lens' || lower === 'smart') return 'Smart';
    if (lower === 'clip on kids') return 'Clip On Kids';
    if (lower === 'atelier kids') return 'Atelier Kids';
    if (lower === 'opto' || lower === 'optovision') return 'Optovision';
    if (lower === 'transitions gens' || lower === 'orma transitions gen s') return 'Transitions Gen S';
    
    return b.charAt(0).toUpperCase() + b.slice(1);
}

function autoCorrectLab(lab: string | null | undefined): string | null {
    if (!lab) return null;
    let l = lab.toUpperCase().trim();
    if (!l) return null;
    
    const norm = l.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); 
    
    if (/^(OPTO\s*VI[CS]ION|OPTO|OPT)$/i.test(norm)) return 'OPTOVISION';
    if (/^(GRUPO\s*OPTICO|GRUPO|G\.*\s*OPTICO)$/i.test(norm)) return 'GRUPO OPTICO';
    if (/^(LA\s*CAMARA|CAMARA|LA\s*CAM)$/i.test(norm)) return 'LA CAMARA';
    
    return l;
}

function autoCorrectIndex(index: string | null | undefined): string | null {
    if (!index) return null;
    let i = index.trim();
    if (!i) return null;
    
    if (i === '1.5') return '1.50';
    if (i === '1.6') return '1.60';
    if (i === '1.49') return '1.49';
    if (i === '1.56') return '1.56';
    if (i === '1.59') return '1.59';
    if (i === '1.67') return '1.67';
    if (i === '1.74') return '1.74';
    if (i.toLowerCase().includes('foto')) return 'Foto';
    
    // Clear out clear barcode scanning mistakes
    if (i === '836352' || i.length > 5) return null; 
    
    return i;
}

async function main() {
    console.log('Iniciando limpieza de datos...');
    const products = await prisma.product.findMany();
    let updatedCount = 0;

    for (const p of products) {
        const newBrand = autoCorrectBrand(p.brand);
        const newLab = autoCorrectLab(p.laboratory);
        const newIndex = autoCorrectIndex(p.lensIndex);

        if (newBrand !== p.brand || newLab !== p.laboratory || newIndex !== p.lensIndex) {
            await prisma.product.update({
                where: { id: p.id },
                data: {
                    brand: newBrand,
                    laboratory: newLab,
                    lensIndex: newIndex
                }
            });
            console.log(`Corregido: ${p.name} | Marca: ${p.brand}->${newBrand} | Lab: ${p.laboratory}->${newLab} | Indice: ${p.lensIndex}->${newIndex}`);
            updatedCount++;
        }
    }

    console.log(`\n¡Limpieza terminada! Se corrigieron ${updatedCount} productos.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
