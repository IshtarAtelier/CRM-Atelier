export function autoCorrectBrand(brand: string | null | undefined): string | null {
    if (!brand) return null;
    let b = brand.trim();
    if (!b) return null;
    
    // Normalize string to remove accents if needed (though for brands we might keep exact casing)
    const lower = b.toLowerCase();
    
    if (lower === 'hango loose' || lower === 'hangoloose') return 'Hang Loose';
    if (lower === 'hanoveer kids' || lower === 'hannover kid') return 'Hannover Kids';
    if (lower === 'kazwini') return 'Kazwini';
    if (lower === 'varilux') return 'Varilux';
    if (lower === 'grupo optico' || lower === 'grupo óptico') return 'Grupo Optico';
    if (lower === 'smart lens' || lower === 'smart') return 'Smart'; // Unify if requested, but let's just capitalize
    if (lower === 'clip on kids') return 'Clip On Kids';
    if (lower === 'atelier kids') return 'Atelier Kids';
    
    // Title Case default
    return b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();
}

export function autoCorrectLab(lab: string | null | undefined): string | null {
    if (!lab) return null;
    let l = lab.toUpperCase().trim();
    if (!l) return null;
    
    const norm = l.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // removes accents
    
    if (/^(OPTO\s*VI[CS]ION|OPTO|OPT)$/i.test(norm)) return 'OPTOVISION';
    if (/^(GRUPO\s*OPTICO|GRUPO|G\.*\s*OPTICO)$/i.test(norm)) return 'GRUPO OPTICO';
    if (/^(LA\s*CAMARA|CAMARA|LA\s*CAM)$/i.test(norm)) return 'LA CAMARA';
    
    return l;
}

export function autoCorrectIndex(index: string | null | undefined): string | null {
    if (!index) return null;
    let i = index.trim();
    if (!i) return null;
    
    // Correct common misspellings or barcode errors
    if (i === '1.5') return '1.50';
    if (i === '1.6') return '1.60';
    if (i === '1.49') return '1.49';
    if (i === '1.56') return '1.56';
    if (i === '1.59') return '1.59';
    if (i === '1.67') return '1.67';
    if (i === '1.74') return '1.74';
    if (i.toLowerCase().includes('foto')) return 'Foto';
    
    // If it's a completely crazy number like '836352', we could return it or leave it,
    // but the supervisor feature will catch it.
    return i;
}
