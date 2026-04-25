const data = [
    { brand: 'Kodak', type: 'Cristal Multifocal', category: 'Cristal' },
    { brand: 'Smart', type: 'MULTIFOCAL', category: 'Cristal' }
];

const selectedType = 'Cristal Multifocal';
const q = selectedType.toLowerCase();
const subtype = q.startsWith('cristal ') ? q.replace('cristal ', '') : null;

const filtered = data.filter(p => {
    const type = p.type?.toLowerCase() || '';
    const category = p.category?.toLowerCase() || '';
    return (
        type === q ||
        type.includes(q) ||
        category === q ||
        category.includes(q) ||
        (subtype !== null && (type === subtype || type.includes(subtype)))
    );
});

console.log(filtered);
