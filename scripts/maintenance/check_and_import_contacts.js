const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const contacts = [
  { name: "Tiago Macchi", dni: "41681272", phone: "3513947989", email: null },
  { name: "Tironi Gustavo Alejandro", dni: "12738404", phone: "3515630129", email: null },
  { name: "Tomas De Grave", dni: "38501083", phone: "3512630996", email: "tomasdegrave@gmail.com" },
  { name: "Torres Cesar", dni: "428156141", phone: "3516364783", email: null },
  { name: "Trettel Liliana Silvana", dni: "18014416", phone: "3515417230", email: null },
  { name: "Usandivaras Paola", dni: "31901421", phone: "3512265469", email: null },
  { name: "Usandivaras Sergio Jeremias", dni: "33975398", phone: "3543698430", email: null },
  { name: "Valentina Rolon Alvarez", dni: "52865274", phone: "3515166294", email: null },
  { name: "Veonica Lomonaco Andrea", dni: "26612570", phone: "3516741888", email: "guillermoclopes@hotmail.com" },
  { name: "Vera Agustina", dni: null, phone: "3512026664", email: null },
  { name: "Veronica Sola", dni: "30882162", phone: "3516792452", email: null },
  { name: "Veronica Andrea Lopez", dni: "26482221", phone: "3513413380", email: "martillerolopez@gmail.com" },
  { name: "Veronica Del Valle Ferreyra", dni: "22424113", phone: "3515914814", email: null },
  { name: "Veronica Lucero", dni: "29967177", phone: "3516567604", email: null },
  { name: "Vicotria Herrera", dni: "407511913", phone: "3541571444", email: null },
  { name: "Victoria Lucero", dni: "49557120", phone: "3513555199", email: null },
  { name: "Victoria Rueda", dni: "55838223", phone: "3513068156", email: "ruedadiego1981@gmail.com" },
  { name: "Vilma Lali Degiovanni", dni: "13972546", phone: "3544618326", email: null },
  { name: "Villagra Rocio", dni: "39421672", phone: "3513012234", email: null },
  { name: "Virginia Cella", dni: "40906385", phone: "3571329881", email: null },
  { name: "Virginia Volonte", dni: "25141360", phone: "3584409908", email: null },
  { name: "Walter Antunia", dni: "24695204", phone: "3515574346", email: null },
  { name: "Walter Daniel Di Cicco", dni: "17281429", phone: "2966419954", email: null },
  { name: "Walter Heredia", dni: "22197592", phone: "3543546338", email: "walterheredia777@gmail.com" },
  { name: "Yani pissano", dni: null, phone: "3541215971", email: null },
  { name: "Yunis Fabiola", dni: "17651414", phone: "3704568045", email: "jimenesyuniz@gmail.com" },
  { name: "Zabalaga Roberto", dni: "92398474", phone: "3515203762", email: null },
  { name: "Zamora Natalia Ines", dni: "28648646", phone: "351876777", email: "nataliaizamora@hotmail.com" },
  { name: "Zapata Carlos Martin", dni: "26480343", phone: "3515742689", email: null },
  { name: "Zardini Azrael", dni: "41263144", phone: "3517712475", email: null },
  { name: "Zoe Quiroga", dni: "70240542", phone: "3513130505", email: null },
  { name: "Zoe Valenzuela", dni: "52542674", phone: "3873652018", email: null },
  { name: "Zulma Laperyn", dni: "63014563", phone: null, email: null },
];

// Skip "Victoria" (duplicate of Vicotria Herrera, same phone)

async function main() {
  console.log(`\n=== Verificando ${contacts.length} contactos ===\n`);
  
  const existing = [];
  const missing = [];

  for (const c of contacts) {
    // Search by phone OR by DNI
    const found = await prisma.client.findFirst({
      where: {
        OR: [
          ...(c.phone ? [{ phone: { contains: c.phone.slice(-8) } }] : []),
          ...(c.dni ? [{ dni: c.dni }] : []),
        ]
      }
    });

    if (found) {
      existing.push({ input: c.name, foundAs: found.name, id: found.id });
    } else {
      missing.push(c);
    }
  }

  console.log(`✅ YA EXISTEN: ${existing.length}`);
  existing.forEach(e => console.log(`   - ${e.input} → "${e.foundAs}"`));

  console.log(`\n❌ NO ENCONTRADOS: ${missing.length}`);
  missing.forEach(m => console.log(`   - ${m.name} (DNI: ${m.dni || '-'}, Tel: ${m.phone || '-'})`));

  // Insert missing contacts
  if (missing.length > 0) {
    console.log(`\n🔄 Insertando ${missing.length} contactos faltantes...`);
    let inserted = 0;
    for (const m of missing) {
      try {
        await prisma.client.create({
          data: {
            name: m.name,
            dni: m.dni || null,
            phone: m.phone || null,
            email: m.email || null,
            status: 'NEW',
          }
        });
        inserted++;
        console.log(`   ✅ ${m.name}`);
      } catch (err) {
        console.log(`   ⚠️ Error con ${m.name}: ${err.message}`);
      }
    }
    console.log(`\n🎉 Insertados: ${inserted} de ${missing.length}`);
  } else {
    console.log('\n🎉 Todos los contactos ya están en la base!');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
