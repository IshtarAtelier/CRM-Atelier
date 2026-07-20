import 'dotenv/config';

// La clave privada de Payway se lee de entorno — NUNCA hardcodearla (queda en el
// historial de git). Setear PAYWAY_PRIVATE_KEY en el .env local para correr esto.
// IMPORTANTE: la clave que estaba embebida acá quedó expuesta en el historial y
// debe ROTARSE desde el panel de Payway.
const privateKey = process.env.PAYWAY_PRIVATE_KEY;

async function main() {
  if (!privateKey) {
    console.error('Falta PAYWAY_PRIVATE_KEY en el entorno. Abortando.');
    process.exit(1);
  }
  const url = `https://live.decidir.com/api/v2/payments?offset=0&limit=5`;
  
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': privateKey
    }
  });

  const data = await res.json();
  console.log('API RESPONSE STATUS:', res.status);
  
  if (data && data.results) {
    console.log(`FOUND ${data.results.length} RECENT PAYMENTS:`);
    for (const payment of data.results) {
      console.log('------------------------------------');
      console.log('ID:', payment.id);
      console.log('SITE TX ID:', payment.site_transaction_id);
      console.log('AMOUNT:', payment.amount);
      console.log('STATUS:', payment.status);
      console.log('DATE:', payment.date);
      console.log('STATUS DETAILS:', JSON.stringify(payment.status_details));
      console.log('FRAUD DETECTION:', JSON.stringify(payment.fraud_detection));
    }
  } else {
    console.log('API RESPONSE:', JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
