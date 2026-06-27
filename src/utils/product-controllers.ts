export function autoCorrectBrand(brand: string | null | undefined): string | null {
    if (!brand) return null;
    const b = brand.trim();
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
    const l = lab.toUpperCase().trim();
    if (!l) return null;
    
    const norm = l.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // removes accents
    
    if (/^(OPTO\s*VI[CS]ION|OPTO|OPT)$/i.test(norm)) return 'OPTOVISION';
    if (/^(GRUPO\s*OPTICO|GRUPO|G\.*\s*OPTICO)$/i.test(norm)) return 'GRUPO OPTICO';
    if (/^(LA\s*CAMARA|CAMARA|LA\s*CAM)$/i.test(norm)) return 'LA CAMARA';
    
    return l;
}

export function autoCorrectIndex(index: string | null | undefined): string | null {
    if (!index) return null;
    const i = index.trim();
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

export function getProductAttributes(modelName: string | null | undefined, seoTags?: string | null | undefined): { shape: string; material: string } {
    const modelUpper = (modelName || '').toUpperCase().trim();
    const tagsUpper = (seoTags || '').toUpperCase().trim();
    
    // 1. Determine Material
    let material = '';
    if (tagsUpper.includes('TITANIO') || tagsUpper.includes('TITANIUM')) {
        material = 'Titanio';
    } else if (tagsUpper.includes('ACETATO')) {
        material = 'Acetato';
    } else if (tagsUpper.includes('METAL')) {
        material = 'Metal';
    } else if (tagsUpper.includes('TR90') || tagsUpper.includes('TR-90')) {
        material = 'TR90';
    } else {
        // Fallback to model code analysis
        if (modelUpper.includes('TG') || modelUpper.includes('TITANIUM') || modelUpper.includes('TITANIO')) {
            material = 'Titanio';
        } else if (modelUpper.includes('ACETATO') || modelUpper.includes('WJ5022') || modelUpper.includes('CAREY') || modelUpper.includes('VINTAGE') || ["57201LJH", "57202LJH", "BC3059", "FD88810", "FD88821", "P5783", "P5786", "P5787", "Q5005", "Q5205", "Q6013", "Q8013", "YF3090", "BC3063", "JYB238015 C2-1"].some(code => modelUpper.includes(code))) {
            material = 'Acetato';
        } else {
            material = 'Metal';
        }
    }
    
    // 2. Determine Shape
    let shape = '';
    if (tagsUpper.includes('CAT-EYE') || tagsUpper.includes('CATEYE') || tagsUpper.includes('GATO')) {
        shape = 'Cat-Eye';
    } else if (tagsUpper.includes('HEXAGONAL')) {
        shape = 'Hexagonal';
    } else if (tagsUpper.includes('REDONDO') || tagsUpper.includes('REDONDA')) {
        shape = 'Redondo';
    } else if (tagsUpper.includes('AVIADOR')) {
        shape = 'Aviador';
    } else if (tagsUpper.includes('CUADRADO') || tagsUpper.includes('CUADRADA')) {
        shape = 'Cuadrado';
    } else if (tagsUpper.includes('XL')) {
        shape = 'XL';
    } else {
        // Fallback to model code analysis
        if (modelUpper.includes('3684')) {
            shape = 'Cuadrado, XL';
        } else if (modelUpper.includes('XL')) {
            shape = 'XL';
        } else if (modelUpper.includes('91501') || modelUpper.includes('901501') || modelUpper.includes('G7013') || modelUpper.includes('ZTGX')) {
            shape = 'Cuadrado';
        } else if (modelUpper.includes('AVIADOR')) {
            shape = 'Aviador';
        } else if (modelUpper.includes('238015')) {
            shape = 'Cat-Eye, Hexagonal';
        } else if (modelUpper.includes('69CE') || modelUpper.includes('69CD') || modelUpper.includes('238014') || modelUpper.includes('HEXAGONAL')) {
            shape = 'Hexagonal';
        } else if (modelUpper.includes('7015') || modelUpper.includes('3932') || modelUpper.includes('CAT-EYE') || modelUpper.includes('GATO')) {
            shape = 'Cat-Eye';
        } else if (modelUpper.includes('011') || modelUpper.includes('238013') || modelUpper.includes('5217') || modelUpper.includes('9030') || modelUpper.includes('REDONDO')) {
            shape = 'Redondo';
        } else {
            shape = 'Cuadrado';
        }
    }
    
    return { shape, material };
}

export function getSelectedShapeFromTags(tags: string | null | undefined): string {
    if (!tags) return '';
    const t = tags.toLowerCase();
    if (t.includes('cat-eye') || t.includes('cateye')) return 'Cat-Eye';
    if (t.includes('hexagonal')) return 'Hexagonal';
    if (t.includes('redondo') || t.includes('redonda')) return 'Redondo';
    if (t.includes('aviador')) return 'Aviador';
    if (t.includes('cuadrado') || t.includes('cuadrada')) return 'Cuadrado';
    if (t.includes('xl')) return 'XL';
    return '';
}

export function getSelectedMaterialFromTags(tags: string | null | undefined): string {
    if (!tags) return '';
    const t = tags.toLowerCase();
    if (t.includes('titanio') || t.includes('titanium')) return 'Titanio';
    if (t.includes('acetato')) return 'Acetato';
    if (t.includes('metal')) return 'Metal';
    if (t.includes('tr90')) return 'TR90';
    return '';
}

export function updateTagsWithShapeAndMaterial(tags: string | null | undefined, newShape: string, newMaterial: string): string {
    const list = (tags || '').split(',').map(s => s.trim()).filter(Boolean);
    
    // Remove existing shape tags case-insensitively
    const shapes = ['cat-eye', 'cateye', 'hexagonal', 'redondo', 'redonda', 'aviador', 'cuadrado', 'cuadrada', 'xl'];
    let filtered = list.filter(t => !shapes.includes(t.toLowerCase()));
    
    // Remove existing material tags case-insensitively
    const materials = ['titanio', 'titanium', 'acetato', 'metal', 'tr90'];
    filtered = filtered.filter(t => !materials.includes(t.toLowerCase()));
    
    // Add new ones
    if (newShape) filtered.push(newShape);
    if (newMaterial) filtered.push(newMaterial);
    
    return filtered.join(', ');
}
