// PrismaClient – compatible con Docker (local node_modules) y host (parent node_modules)
const path = require('path');

let PrismaClient;
try {
    // Docker: @prisma/client está en /app/node_modules
    PrismaClient = require('@prisma/client').PrismaClient;
} catch {
    // Host/dev: @prisma/client vive en el node_modules del proyecto raíz
    PrismaClient = require(path.join(__dirname, '..', 'node_modules', '@prisma', 'client')).PrismaClient;
}

const prisma = new PrismaClient();
module.exports = { prisma };
