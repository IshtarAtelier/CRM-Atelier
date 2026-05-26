/**
 * Helper utility to format and group order items for logs and summaries.
 */

function formatOpt(val: number | null | undefined): string | null {
    if (val === null || val === undefined) return null;
    const sign = val > 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}`;
}

export function formatOrderItemsSummary(items: any[]): string {
    if (!items || items.length === 0) return 'Sin productos';

    // Group items by their brand and name/model snapshot
    const groups: { [key: string]: { brand: string; name: string; quantity: number; details: string[] } } = {};

    for (const item of items) {
        const brand = item.productBrandSnapshot || item.product?.brand || '';
        const name = item.productNameSnapshot || item.product?.name || item.product?.model || '';
        const key = `${brand} ${name}`.trim() || 'Producto';

        if (!groups[key]) {
            groups[key] = {
                brand,
                name,
                quantity: 0,
                details: []
            };
        }

        groups[key].quantity += item.quantity || 1;

        // Extract eye details (prescription details if any)
        const rxParts: string[] = [];
        if (item.eye) {
            rxParts.push(item.eye);
        }

        if (item.sphereVal != null || item.cylinderVal != null || item.axisVal != null || item.additionVal != null) {
            const vals: string[] = [];
            const esfStr = formatOpt(item.sphereVal);
            const cilStr = formatOpt(item.cylinderVal);
            
            if (esfStr !== null) {
                vals.push(`Esf: ${esfStr}`);
            }
            if (cilStr !== null) {
                vals.push(`Cil: ${cilStr}`);
            }
            if (item.axisVal != null) {
                vals.push(`Eje: ${item.axisVal}°`);
            }
            if (item.additionVal != null) {
                vals.push(`Add: ${item.additionVal.toFixed(2)}`);
            }
            if (vals.length > 0) {
                rxParts.push(vals.join(' '));
            }
        }

        if (rxParts.length > 0) {
            groups[key].details.push(rxParts.join(' '));
        }
    }

    return Object.values(groups).map(g => {
        let summary = `${g.quantity}x ${g.brand} ${g.name}`.trim();
        if (g.details.length > 0) {
            summary += ` (${g.details.join(' / ')})`;
        }
        return summary;
    }).join('\n• ');
}
