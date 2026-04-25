import { prisma } from '@/lib/db';
import { autoCorrectBrand, autoCorrectLab, autoCorrectIndex } from '@/utils/product-controllers';

export const ProductService = {
    async getAll() {
        return await prisma.product.findMany({
            orderBy: { brand: 'asc' }
        });
    },

    async getByType(type: string) {
        return await prisma.product.findMany({
            where: { type },
            orderBy: { brand: 'asc' }
        });
    },

    async getByCategory(category: string) {
        return await prisma.product.findMany({
            where: { category },
            orderBy: { brand: 'asc' }
        });
    },

    async create(data: any) {
        return await prisma.product.create({
            data: {
                name: data.name,
                brand: autoCorrectBrand(data.brand),
                model: data.model,
                type: data.type,
                category: data.category,
                price: parseFloat(data.price) || 0,
                cost: parseFloat(data.cost) || 0,
                stock: parseInt(data.stock) || 0,
                lensIndex: autoCorrectIndex(data.lensIndex),
                unitType: data.unitType || 'UNIDAD',
                laboratory: autoCorrectLab(data.laboratory),
                sphereMin: data.sphereMin != null ? parseFloat(data.sphereMin) : null,
                sphereMax: data.sphereMax != null ? parseFloat(data.sphereMax) : null,
                cylinderMin: data.cylinderMin != null ? parseFloat(data.cylinderMin) : null,
                cylinderMax: data.cylinderMax != null ? parseFloat(data.cylinderMax) : null,
                additionMin: data.additionMin != null ? parseFloat(data.additionMin) : null,
                additionMax: data.additionMax != null ? parseFloat(data.additionMax) : null,
                is2x1: data.is2x1 === true,
            }
        });
    },
    async update(id: string, data: any) {
        return await prisma.product.update({
            where: { id },
            data: {
                name: data.name,
                brand: data.brand !== undefined ? autoCorrectBrand(data.brand) : undefined,
                model: data.model,
                type: data.type,
                category: data.category,
                price: parseFloat(data.price) || 0,
                cost: parseFloat(data.cost) || 0,
                stock: parseInt(data.stock) || 0,
                lensIndex: data.lensIndex !== undefined ? autoCorrectIndex(data.lensIndex) : undefined,
                unitType: data.unitType !== undefined ? data.unitType : undefined,
                laboratory: data.laboratory !== undefined ? autoCorrectLab(data.laboratory) : undefined,
                sphereMin: data.sphereMin !== undefined ? (data.sphereMin != null ? parseFloat(data.sphereMin) : null) : undefined,
                sphereMax: data.sphereMax !== undefined ? (data.sphereMax != null ? parseFloat(data.sphereMax) : null) : undefined,
                cylinderMin: data.cylinderMin !== undefined ? (data.cylinderMin != null ? parseFloat(data.cylinderMin) : null) : undefined,
                cylinderMax: data.cylinderMax !== undefined ? (data.cylinderMax != null ? parseFloat(data.cylinderMax) : null) : undefined,
                additionMin: data.additionMin !== undefined ? (data.additionMin != null ? parseFloat(data.additionMin) : null) : undefined,
                additionMax: data.additionMax !== undefined ? (data.additionMax != null ? parseFloat(data.additionMax) : null) : undefined,
                is2x1: data.is2x1 !== undefined ? Boolean(data.is2x1) : undefined,
            }
        });
    },

    async bulkCreate(items: any[]) {
        return await prisma.product.createMany({
            data: items.map(item => ({
                name: item.name,
                brand: autoCorrectBrand(item.brand),
                model: item.model,
                type: item.type,
                category: item.category,
                price: parseFloat(item.price) || 0,
                cost: parseFloat(item.cost) || 0,
                stock: parseInt(item.stock) || 0,
                lensIndex: autoCorrectIndex(item.lensIndex),
                unitType: item.unitType || 'UNIDAD',
                laboratory: autoCorrectLab(item.laboratory),
                sphereMin: item.sphereMin != null ? parseFloat(item.sphereMin) : null,
                sphereMax: item.sphereMax != null ? parseFloat(item.sphereMax) : null,
                cylinderMin: item.cylinderMin != null ? parseFloat(item.cylinderMin) : null,
                cylinderMax: item.cylinderMax != null ? parseFloat(item.cylinderMax) : null,
                additionMin: item.additionMin != null ? parseFloat(item.additionMin) : null,
                additionMax: item.additionMax != null ? parseFloat(item.additionMax) : null,
                is2x1: item.is2x1 === true,
            }))
        });
    }
};
