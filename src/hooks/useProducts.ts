'use client';

import { useState, useEffect, useCallback } from 'react';

export interface Product {
    id: string;
    name: string | null;
    brand: string | null;
    model: string | null;
    category: string;
    type: string | null;
    stock: number;
    price: number;
    cost: number;
    lensIndex: string | null;
    unitType: string | null;
    laboratory: string | null;
    is2x1: boolean;
    // Rangos de fabricación
    sphereMin: number | null;
    sphereMax: number | null;
    cylinderMin: number | null;
    cylinderMax: number | null;
    additionMin: number | null;
    additionMax: number | null;
}

export function useProducts(searchQuery: string = '', selectedType: string = 'ALL') {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProducts = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/products?_cb=${Date.now()}`);
            if (res.ok) {
                let data: Product[] = await res.json();

                // Filtering
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    data = data.filter(p =>
                        (p.name?.toLowerCase().includes(q)) ||
                        (p.brand?.toLowerCase().includes(q)) ||
                        (p.model?.toLowerCase().includes(q))
                    );
                }

                if (selectedType !== 'ALL') {
                    const q = selectedType.toLowerCase();
                    // Also extract the subtype without "cristal " prefix
                    // e.g. "Cristal Multifocal" → "multifocal" to match legacy type="MULTIFOCAL"
                    const subtype = q.startsWith('cristal ') ? q.replace('cristal ', '') : null;
                    data = data.filter(p => {
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
                }

                // Always sort by price ascending (cheapest first)
                data.sort((a, b) => (a.price || 0) - (b.price || 0));

                setProducts(data);
                setError(null);
            } else {
                throw new Error('Error al cargar productos');
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [searchQuery, selectedType]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    const deleteProduct = async (id: string) => {
        try {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                await fetchProducts();
                return { success: true };
            }
            return { success: false, error: data.error || 'Error al eliminar producto' };
        } catch (error) {
            return { success: false, error: 'Error de conexión' };
        }
    };

    const bulkDelete = async (ids: string[]) => {
        const errors: string[] = [];
        for (const id of ids) {
            try {
                const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
                if (!res.ok) {
                    const data = await res.json();
                    errors.push(data.error || `Error eliminando producto ${id}`);
                }
            } catch {
                errors.push(`Error de conexión eliminando producto ${id}`);
            }
        }
        await fetchProducts();
        return { success: errors.length === 0, errors };
    };

    return {
        products,
        loading,
        error,
        refresh: fetchProducts,
        deleteProduct,
        bulkDelete
    };
}

