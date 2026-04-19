import forge from 'node-forge';
import fs from 'fs';

console.log("Generando clave...");
const keys = forge.pki.rsa.generateKeyPair(2048);

const csr = forge.pki.createCertificationRequest();
csr.publicKey = keys.publicKey;
csr.setSubject([
    { name: 'C', value: 'AR' },
    { name: 'O', value: 'Atelier CRM' },
    { name: 'CN', value: 'CRM Yani' },
    { name: 'serialNumber', value: 'CUIT 27351217112' }
]);

csr.sign(keys.privateKey, forge.md.sha256.create());

const pemPrivateKey = forge.pki.privateKeyToPem(keys.privateKey);
const pemCsr = forge.pki.certificationRequestToPem(csr);

fs.writeFileSync('yani.key', pemPrivateKey);
fs.writeFileSync('yani.csr', pemCsr);
console.log("Archivos generados exitosamente: yani.key y yani.csr");
