import fs from 'fs';

const content = fs.readFileSync('../duplicate-clients-list.md', 'utf-8');
const groups = content.split('### Grupo ').slice(1);

function isSamePerson(names: string[]) {
    // Normalize names
    const normalized = names.map(n => n.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
    
    // Check for exact matches
    if (new Set(normalized).size === 1) return true;
    
    // Check for substrings (e.g., "ishtar" is in "ishtarpissano")
    for (let i = 0; i < normalized.length; i++) {
        for (let j = i + 1; j < normalized.length; j++) {
            if (normalized[i].includes(normalized[j]) || normalized[j].includes(normalized[i])) {
                return true;
            }
        }
    }
    
    // Check word overlap
    const wordSets = names.map(n => new Set(n.toLowerCase().trim().split(/\s+/)));
    let matchFound = false;
    for (let i = 0; i < wordSets.length; i++) {
        for (let j = i + 1; j < wordSets.length; j++) {
            const intersection = new Set([...wordSets[i]].filter(x => wordSets[j].has(x)));
            // If they share at least one significant word (len > 3) they might be the same person
            const significantMatches = Array.from(intersection).filter((w: string) => w.length > 3);
            if (significantMatches.length >= 1) {
                matchFound = true;
                break;
            }
            
            // Or if names are just flipped (e.g. "Silvia Castellano" vs "Castellano Silvia")
            // handled by intersection size
            if (intersection.size >= 2) {
                matchFound = true;
                break;
            }
        }
    }
    
    return matchFound;
}

console.log("=== POSIBLES MISMA PERSONA ===");
groups.forEach(g => {
    const lines = g.split('\n');
    const names = lines.filter(l => l.startsWith('- **')).map(l => l.replace('- **', '').replace('**', '').trim());
    if (names.length > 1 && isSamePerson(names)) {
        console.log(`\n**Grupo ${g.substring(0, g.indexOf('\n'))}**`);
        names.forEach(n => console.log(`- ${n}`));
    }
});
