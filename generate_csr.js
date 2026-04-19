const forge = require('node-forge');
const fs = require('fs');

async function run() {
    console.log("Generando clave privada RSA de 2048 bits...");
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const privateKey = forge.pki.privateKeyToPem(keys.privateKey);

    console.log("Creando archivo de solicitud CSR para AFIP...");
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;
    csr.setSubject([
        { shortName: 'C', value: 'AR' },
        { shortName: 'O', value: 'Yani Pissano' },
        { shortName: 'CN', value: 'Yani Pissano CRM' },
        { name: 'serialNumber', value: 'CUIT 27425128138' }
    ]);
    
    csr.sign(keys.privateKey, forge.md.sha256.create());
    const csrPem = forge.pki.certificationRequestToPem(csr);

    fs.writeFileSync('YANI.key', privateKey);
    fs.writeFileSync('YANI.csr', csrPem);

    console.log("\nArchivos creados con éxito en la raíz del proyecto:");
    console.log(`- YANI.key`);
    console.log(`- YANI.csr`);
}

run().catch(console.error);
