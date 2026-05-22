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

module.exports = { prisma };
