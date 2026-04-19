const forge = require('node-forge');

const pem = `-----BEGIN CERTIFICATE-----
MIIDRjCCAi6gAwIBAgIISiwawro4ldcwDQYJKoZIhvcNAQENBQAwMzEVMBMGA1UEAwwMQ29tcHV0
YWRvcmVzMQ0wCwYDVQQKDARBRklQMQswCQYDVQQGEwJBUjAeFw0yNjA0MTkxNjAyMzhaFw0yODA0
MTgxNjAyMzhaMDExFDASBgNVBAMMC0F0ZWxpZXJDcm0yMRkwFwYDVQQFExBDVUlUIDI3NDI1MTI4
MTM4MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA6agATWFFHGofViFAiya/Y/EyGEnf
yogQ1Nt7u56el4T+QSXTNlBa+AzBk94ZDI6cjnbws2UXKwuIqUUyVoLPpkiruM0SVMkh4BLQIJMk
kbgBYBNb+7t0QDvTBI2x+UQXTXEId+y3K38WgMpyRj7EJnjQxHSlALwHgC7AGYbvKwSDhZsp8Ou8
s/aiRH2lYJ/CR91LJMtB7A3YMfP84RhIRirgjizE8eCxw0kbqKycjnXKNMnhqzpNgb1nL6BSWT+J
vAdhIYfuE2Eeq8Nj6/cYEhhKqKyrr9wCq4c43Pa6CTGNJyEbMSWJMN7/tEwcV5LRRXliyReaEQJs
uotu7Q0JtwIDAQABo2AwXjAMBgNVHRMBAf8EAjAAMB8GA1UdIwQYMBaAFCsNL8jfYf0IyU4R0DWT
BG2OW9BuMB0GA1UdDgQWBBRkz1YsVSdmSm2yIVVtL+maJqAcljAOBgNVHQ8BAf8EBAMCBeAwDQYJ
KoZIhvcNAQENBQADggEBAJ4fZTNHHwk8bSfZUVesJPSflbHrD8hyJeF4QgSQz86nAyzfXECowpr9
7wkNUYlmXxghEatzLwvTVU9tsk1P0x+PEdtwJ8BeXRgD1kgbFKYvqtEnhHx+1XmyDK2k8B43Rv19
67cTsFl3/z8KtuXSTmQVBMOtDw5YDv7aqWlyhX3wFidycyeJ1NUN+mw8i2hbPPwxgDlyeTlmEOqb
nF5mMqXweM8XAQ3zwzO92dTrO9NuCrWQ8zmHDa2RlwiP0JzLvwwSu5xqyliL9TI6Zvw8ugZJdm0R
WfTpcApf91s9+Y+1wUexqo6yrSuA6kKsGhdLoKNluT7cv015Fka9UtCB9w0=
-----END CERTIFICATE-----`;

try {
    const cert = forge.pki.certificateFromPem(pem);
    console.log("Issuer:", cert.issuer.attributes.map(a => a.value).join(', '));
    console.log("Subject:", cert.subject.attributes.map(a => a.value).join(', '));
    console.log("Valid From:", cert.validity.notBefore);
    console.log("Valid To:", cert.validity.notAfter);
} catch(err) {
    console.error("Error validando el certificado:", err.message);
}
