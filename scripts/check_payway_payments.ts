const privateKey = 'd8fc0a2ba2404f3db7c7f92c5665a79c'; // Production private key

async function main() {
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
