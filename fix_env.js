const fs=require('fs'); 
const fb=fs.readFileSync('firebase_env.txt', 'utf8'); 
const envLines=[
'DATABASE_URL="postgresql://postgres:rPSyETnmDeqAUqKGIEHEUmcbSALAi@interchange.proxy.rlwy.net:12579/railway"',
'JWT_SECRET="atelier-optica-jwt-secret-8k2xm9q4vNvWs1"',
'',
'AFIP_CUIT_ISH=20409387472',
'AFIP_ACCESS_TOKEN_ISH=hP32uZcZcXAUb9wyfGsw13e7QYaF0B69w4VOB0t86CTuO7xPNeRdxyl7WTBM6D5K',
'AFIP_PUNTO_VENTA_ISH=1',
'',
'AFIP_CUIT_YANI=27351217112',
'AFIP_ACCESS_TOKEN_YANI=Lq3iVp2kah7VaIhEf5vPCcrehIDiNSKBvz7HNSLF9xdCDxFTYVC7iLnTXAezwxB1',
'AFIP_PUNTO_VENTA_YANI=1',
'', 
fb]; 
fs.writeFileSync('.env', envLines.join('\n'), 'utf8'); 
fs.existsSync('.env.fixed') && fs.unlinkSync('.env.fixed'); 
fs.existsSync('.env.restored') && fs.unlinkSync('.env.restored'); 
fs.existsSync('firebase_env.txt') && fs.unlinkSync('firebase_env.txt');
