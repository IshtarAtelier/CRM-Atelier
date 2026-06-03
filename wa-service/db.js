// PrismaClient – compatible con Docker (local node_modules) y host (parent node_modules)
const path = require('path');

let PrismaClient;
let prisma;

try {
    PrismaClient = require('@prisma/client').PrismaClient;
    prisma = new PrismaClient();
} catch (error) {
    PrismaClient = require(path.join(__dirname, '..', 'node_modules', '@prisma', 'client')).PrismaClient;
    prisma = new PrismaClient();
}

// Probar conexión a la base de datos al inicializar
prisma.$connect()
    .then(() => {
        console.log('✅ Prisma conectado exitosamente a la base de datos.');
    })
    .catch((err) => {
        console.error('❌ Error de conexión inicial en Prisma:', err.message);
    });

module.exports = { prisma };
