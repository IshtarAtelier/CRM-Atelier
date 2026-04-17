const axios = require('axios');

const TOKEN = 'hP32uZcZcXAUb9wyfGsw13e7QYaF0B69w4VOB0t86CTuO7xPNeRdxyl7WTBM6D5K';

const cert = `-----BEGIN CERTIFICATE-----
MIIDRTCCAi2gAwIBAgIIXN8BiXWZ18swDQYJKoZIhvcNAQENBQAwMzEVMBMGA1UEAwwMQ29tcHV0
YWRvcmVzMQ0wCwYDVQQKDARBRklQMQswCQYDVQQGEwJBUjAeFw0yNjA0MDYwMTA4MDZaFw0yODA0
MDUwMTA4MDZaMDAxEzARBgNVBAMMCkF0ZWxpZXJDUk0xGTAXBgNVBAUTEENVSVQgMjMzODYxNTIz
MTQwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCf4GH3XtxWoDrceLFoZddsvpwVH98I
JeFwB+/tLMmLhGc1dS3hIUUKgD7SaDGyCqq6T012e3ahcGu5XCa/vx3zpcPxsD3njmngi01mdjA6
Ms7FYTJr5i/zp1yachkHCEmwpZfeCEOAHGIJQ5jkYoV2ik1EBK6gG413FI6LXoKHwsEEYCbdAzzE
r+2TfjoZKwVYyjz47RQzkg+N+SKAJzEHemMeB1hKcz2ThXLWrNue8BLdUnEB8CLAiZ5CcSiqKsm/
UlTIZp1X225pDBFDtLhYx/z3TuY9RqQVQ1pmOSvFAV2WpfAi6vn6UJQarwraRmmODobF2A8wSxHP
B+3H3sETAgMBAAGjYDBeMAwGA1UdEwEB/wQCMAAwHwYDVR0jBBgwFoAUKw0vyN9h/QjJThHQNZME
bY5b0G4wHQYDVR0OBBYEFOjcNqmpEbnzBnZsVMB4IChlvF5ZMA4GA1UdDwEB/wQEAwIF4DANBgkq
hkiG9w0BAQ0FAAOCAQEAxcM+yg2fo6GBUKMu2PI0968Uv/AYdf8f+TTGHUcV4o0LFS95DYkie4SZ
VRphT1zs1glBp0qubvHg14DICDfSDEpflTByR4l3eNsz+JtJUFSsJvyOUKiSRDOt1guJz5U1gXbB
nUrFNwu6a3guTxjvqCl973e3y1unL/VCrRKoMSF8+Cm3XfUnnsPXHyS8lgCM2hgFTLdxbxKrf5/1
PpJ7OB6tw/tvF0Ql3ZrkcAfqKliTJNE6+uevq2z3A4TIjbSZFDR+Uds760VAE3hGqNpyyCQ1dgjT
rTe1epTUgQJxXOT7+230oAoG6CYr/eDmRNa04eolOjCXNyPyfjqmHYgsYg==
-----END CERTIFICATE-----`;

const key = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCf4GH3XtxWoDrc
eLFoZddsvpwVH98IJeFwB+/tLMmLhGc1dS3hIUUKgD7SaDGyCqq6T012e3ahcGu5
XCa/vx3zpcPxsD3njmngi01mdjA6Ms7FYTJr5i/zp1yachkHCEmwpZfeCEOAHGIJ
Q5jkYoV2ik1EBK6gG413FI6LXoKHwsEEYCbdAzzEr+2TfjoZKwVYyjz47RQzkg+N
+SKAJzEHemMeB1hKcz2ThXLWrNue8BLdUnEB8CLAiZ5CcSiqKsm/UlTIZp1X225p
DBFDtLhYx/z3TuY9RqQVQ1pmOSvFAV2WpfAi6vn6UJQarwraRmmODobF2A8wSxHP
B+3H3sETAgMBAAECggEAGOBrrfeTNmFxNzwKctGh7xhLphfS9uwaA3ogsZlt9OkR
vCYzENxB52vkGo4+6VKylRHg3kZAw8b/5BQ8LUraKL7K2fEP+NdWjyttzDsoru2X
8et5UoO7Q2DvzlJhpY/7E2L42gIUKrt/36wmfqb72GGVuzc1StFutjA7K+F1UxVS
SINxQ3ruuHHycjJT/UqEtWPm4Ie/oCcFzAPqOSNyqc7RHqoDmZ4aLlhRdkzgoIEF
LorffMIry/D4ZAOfaeTU9RawCCzDUN6AdRM/qU9SDmh5np+i7hYNt7DN4n6P4srr
nLf7jrCAkML/YvHRVKxK0HGp25+s8tw25aVh7tcY0QKBgQDLrO5dG8MHWyLd9wG/
F7HtLZaBmLKisVfmFV40fMaTbbiXQlO8ejVmoVv4wblz/1THQMEFeQr1VuwJPmZJ
n4CymyvYKttpVUQgDw+6XO8i15hnzkbqLSTwyskR0ny6YN2rCTMtohXMJ1o74lYs
HZsBPF/py9u3hCf1J/o95xpjwwKBgQDI8u8mx8kYxYDjX8PPM8TiTCYH6GCywcmL
vZLaThiCQXdQYjtKSMY17dGq0ZM+uBrIRwYtzNxggmL+PYsUhpXI6yXLG2vcXjnV
v8C/rB3HRJia+CwIa9ZxYuQVTozfnWHB5nciLv3XZXGTzm1saajSdCNdfkvojDz5
r5gsHPDocQKBgQCge79JwBE5H5dmnDVVE9+Picc4kE/ZH7GpypZy9wokqmSzUoDW
Vtjy6Bum80YkX0C2y5ALtudqjzXmxrMkObjXgqrWZlaCNbw7IoL7DjUjGAuvZ3q7
FB0yWiZ6k4bR+HdRSCt6Pme8eBmCbAIIOr+jBqZwer/CZzBw3DIySoGhrwKBgCP0
Q5H+wR5riComolRagOm0kkFr9JFHVxZnrvTccEouCHkbelxKNRzFFnSn1t6r9i7L
dnGPbAbgjXHL9SyRAA/Y8wQqPdxKB7MVAhnJY/KZdWyU5twC33WeKg0d5trDwA//
emVlXwnBHtdBYha5uPkeyo0Z4d8T6H0MS//olbohAoGAXkNz847+nfGilfwsP6QS
sMVJN0xoNS0R34hRtOgMsKsXTerHa3Cae8SKfT0M63ktWtbJWOjKdnE+u2bxajxp
00ej/g6WePN4Bq/Zi0noERRnZvp9t2Yytyrm92ZQWUN3P3irJ/Mc7UUydSY9L+YH
CqJCyIsWKoLAynl73LGMBp0=
-----END PRIVATE KEY-----`;

async function testToken() {
    try {
        const res = await axios.post('https://app.afipsdk.com/api/v1/afip/wsfe/createNextVoucher', {
            environment: 'prod',
            wsid: 'wsfe',
            tax_id: 23386152314, // ISHTAR
            cert: cert,
            key: key,
            force_create: false,
            voucher: {
                CantReg: 1,
                PtoVta: 1, // Let's guess 1 is ok or fail
                CbteTipo: 11, // C
                Concepto: 1, // Prod
                DocTipo: 96, // DNI
                DocNro: 26144247,
                CbteFch: 20260416,
                ImpTotal: 100,
                ImpTotConc: 0,
                ImpNeto: 100,
                ImpOpEx: 0,
                ImpIVA: 0,
                ImpTrib: 0,
                MonId: 'PES',
                MonCotiz: 1
            }
        }, {
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'sdk-library': 'javascript',
                'sdk-environment': 'prod'
            }
        });
        console.log("SUCCESS!", res.data);
    } catch (err) {
        if (err.response) {
            console.error("FAILED WITH STATUS", err.response.status);
            console.error("RESPONSE DATA:", JSON.stringify(err.response.data, null, 2));
        } else {
            console.error("UNKNOWN ERROR:", err.message);
        }
    }
}

testToken();
