'use client';

import { useState, useEffect } from 'react';

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

    const fetchProducts = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/products');
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
                    data = data.filter(p =>
                        p.category?.toLowerCase() === q ||
                        p.type?.toLowerCase() === q ||
                        p.type?.toLowerCase().includes(q) ||
                        p.category?.toLowerCase().includes(q)
                    );
                }

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
    };

    useEffect(() => {
        fetchProducts();
    }, [searchQuery, selectedType]);

    const deleteProduct = async (id: string) => {
        try {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
            if (res.ok) {
                await fetchProducts();
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    };

    const bulkDelete = async (ids: string[]) => {
        try {
            await Promise.all(ids.map(id => fetch(`/api/products/${id}`, { method: 'DELETE' })));
            await fetchProducts();
            return true;
        } catch (error) {
            return false;
        }
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

