const fs = require('fs');

let pageContent = fs.readFileSync('src/app/promo/page.tsx', 'utf8');

// Update WhatsApp text
pageContent = pageContent.replace(/text=Los%20vi%20en%20CAMPAIGN_ID/g, 'text=Hola!%20Vi%20la%20Promo%202x1%20en%20la%20web%20y%20quiero%20asesoramiento.');

// Remove social media links to avoid distractions
pageContent = pageContent.replace(/<a href='https:\/\/(www\.)?(facebook|instagram|youtube|tiktok)[^>]+>.*?<\/a>\s*/g, '');

fs.writeFileSync('src/app/promo/page.tsx', pageContent);

// Add pulse animation to css
const cssToAdd = `
/* WhatsApp Pulse Animation */
.whatsapp-float {
    animation: pulse-green 2s infinite;
}

@keyframes pulse-green {
    0% {
        box-shadow: 0 0 0 0 rgba(37, 211, 102, 0.7);
    }
    70% {
        box-shadow: 0 0 0 20px rgba(37, 211, 102, 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(37, 211, 102, 0);
    }
}
.btn-cta {
    animation: pulse-green 2s infinite;
}
`;

fs.appendFileSync('src/app/promo/promo.css', cssToAdd);
console.log('Update complete');
