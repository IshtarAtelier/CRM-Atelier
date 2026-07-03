const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const orderItems = [
  { model: "7036", color: "C2", qty: 5 },
  { model: "91501", color: "C6", qty: 5 },
  { model: "Q5205", color: "C2", qty: 5 },
  { model: "Q5205", color: "C3", qty: 5 },
  { model: "Q5205", color: "C4", qty: 5 },
  { model: "Q5205", color: "C5", qty: 5 },
  { model: "JYB238015", color: "C2", qty: 5 },
  { model: "JYB238015", color: "C1", qty: 5 },
  { model: "JYB238015", color: "C2-1", qty: 5 },
  { model: "FG1643", color: "C4", qty: 5 },
  { model: "FG1643", color: "C2", qty: 4 },
  { model: "TL5206", color: "C4", qty: 2 },
  { model: "G5921", color: "C2", qty: 5 },
  { model: "M7027", color: "C4", qty: 5 },
  { model: "TL5208", color: "C2", qty: 5 },
  { model: "FD88810", color: "C1", qty: 5 },
  { model: "Q8013", color: "C3", qty: 5 },
  { model: "Q8013", color: "C6", qty: 5 },
  { model: "Q8013", color: "C1", qty: 5 },
  { model: "Q8013", color: "C5", qty: 5 },
  { model: "Q8013", color: "C7", qty: 4 },
  { model: "Q8013", color: "C2", qty: 5 },
  { model: "M7237", color: "C1", qty: 5 },
  { model: "M7237", color: "C2", qty: 5 },
  { model: "9004M", color: "C3", qty: 5 },
  { model: "9004M", color: "C6", qty: 5 },
  { model: "9004M", color: "C2", qty: 5 },
  { model: "TG2807", color: "C1", qty: 5 },
  { model: "TG2810", color: "C4", qty: 4 },
  { model: "TG2810", color: "C1", qty: 5 },
  { model: "Q5005", color: "C3", qty: 5 },
  { model: "Q5005", color: "C1", qty: 5 },
  { model: "Q5005", color: "C7", qty: 5 },
  { model: "Q5005", color: "C8", qty: 5 },
  { model: "Q5005", color: "C2", qty: 5 },
  { model: "57201LJH", color: "C3", qty: 5 },
  { model: "57201LJH", color: "C7", qty: 5 },
  { model: "57201LJH", color: "C1", qty: 5 },
  { model: "57201LJH", color: "C6", qty: 5 },
  { model: "57201LJH", color: "C4", qty: 5 },
  { model: "HK011", color: "C5", qty: 5 },
  { model: "HK011", color: "C3", qty: 5 },
  { model: "G5970", color: "C1", qty: 5 },
  { model: "HY238013", color: "C1", qty: 5 },
  { model: "TL3684", color: "C4", qty: 5 },
  { model: "TL3684", color: "C5", qty: 5 },
  { model: "M7011", color: "C4", qty: 5 },
  { model: "Q6013", color: "C5", qty: 5 },
  { model: "Q6013", color: "C1", qty: 5 },
  { model: "Q6013", color: "C4", qty: 5 },
  { model: "Q6013", color: "C6", qty: 5 },
  { model: "TL3704A", color: "C5", qty: 5 },
  { model: "TL3704A", color: "C4", qty: 5 },
  { model: "M7239", color: "C4", qty: 5 },
  { model: "V99011", color: "C4", qty: 5 },
  { model: "FD88821", color: "C4", qty: 5 },
  { model: "57202LJH", color: "C5", qty: 5 },
  { model: "57202LJH", color: "C7", qty: 5 },
  { model: "57202LJH", color: "C2", qty: 5 },
  { model: "57202LJH", color: "C6", qty: 5 },
  { model: "BC3063", color: "C1", qty: 5 },
  { model: "P5786", color: "C1", qty: 5 },
  { model: "TL5213", color: "C4", qty: 5 },
  { model: "TL3932", color: "C3", qty: 5 },
  { model: "TL3932", color: "C2", qty: 5 },
  { model: "TL3932", color: "C4", qty: 5 },
  { model: "HY238014", color: "C3", qty: 5 },
  { model: "HY238014", color: "C2", qty: 5 },
  { model: "HY238014", color: "C4-1", qty: 4 },
  { model: "YF3090", color: "C1", qty: 5 },
  { model: "TG2809", color: "C4", qty: 5 },
  { model: "TG2809", color: "C1", qty: 5 },
  { model: "9006M", color: "C1", qty: 5 },
  { model: "9006M", color: "C2", qty: 5 },
  { model: "9006M", color: "C3", qty: 5 },
  { model: "9006M", color: "C4", qty: 5 },
  { model: "G5929", color: "C1", qty: 5 },
  { model: "V99018", color: "C1", qty: 5 },
  { model: "V99018", color: "C3", qty: 5 },
  { model: "G7013", color: "C1", qty: 5 },
  { model: "YX05", color: "C1", qty: 5 },
  { model: "YX05", color: "C2", qty: 5 },
  { model: "YX05", color: "C3", qty: 5 },
  { model: "YX05", color: "C4", qty: 5 },
  { model: "P5783", color: "C3", qty: 5 },
  { model: "BC3059", color: "C1", qty: 5 },
  { model: "M7033", color: "C1", qty: 5 },
  { model: "M7033", color: "C2", qty: 5 },
  { model: "P5787", color: "C4", qty: 5 },
  { model: "G5959", color: "C1", qty: 5 },
  { model: "8005S", color: "C3", qty: 5 },
  { model: "8125S", color: "C3", qty: 5 },
  { model: "8125S", color: "C4", qty: 3 },
  { model: "7018", color: "c5", qty: 5 },
  { model: "A12183", color: "c2", qty: 5 },
  { model: "MLT25026", color: "c1", qty: 5 },
  { model: "TR12173", color: "", qty: 5 }
];

async function main() {
  const products = await prisma.product.findMany({
    include: { webProducts: true }
  });
  
  const missingImages = [];

  for (const item of orderItems) {
    const fullModelName1 = `${item.model} ${item.color}`.trim().toLowerCase();
    const fullModelName2 = `${item.model}-${item.color}`.trim().toLowerCase();
    const fullModelName3 = `${item.model}${item.color}`.trim().toLowerCase();
    
    const matches = products.filter(p => {
        const name = (p.name || "").toLowerCase();
        const model = (p.model || "").toLowerCase();
        return name.includes(fullModelName1) || 
               name.includes(fullModelName2) || 
               name.includes(fullModelName3) ||
               model.includes(fullModelName1) ||
               model.includes(item.model.toLowerCase());
    });

    if (matches.length > 0) {
      let hasImage = false;
      for (const m of matches) {
        if (m.imageUrl || (m.imagenesCatalogo && m.imagenesCatalogo.length > 0)) {
          hasImage = true;
          break;
        }
        if (m.webProducts) {
          for (const wp of m.webProducts) {
            if (wp.imageUrl || (wp.images && wp.images.length > 0)) {
              hasImage = true;
              break;
            }
          }
        }
      }
      
      if (!hasImage) {
        missingImages.push(`${item.model} ${item.color}`.trim());
      }
    }
  }

  console.log("Products without images:", missingImages.length);
  if (missingImages.length > 0) {
    console.log(missingImages.join(', '));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
