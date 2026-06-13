const fs = require('fs');

let html = fs.readFileSync('src/app/promo/original.html', 'utf8');

// Extract body
const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/i);
if (!bodyMatch) {
  console.log("No body found");
  process.exit(1);
}

let body = bodyMatch[1];

// Remove scripts from end of body since we'll add them properly or they might break JSX
body = body.replace(/<script[\s\S]*?<\/script>/gi, '');
body = body.replace(/<noscript>[\s\S]*?<\/noscript>/gi, '');

// Convert HTML comments to JSX comments
body = body.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');

// Basic replacements
body = body.replace(/class=/g, 'className=');
body = body.replace(/for=/g, 'htmlFor=');
body = body.replace(/tabindex=/g, 'tabIndex=');
body = body.replace(/autoplay=/g, 'autoPlay=');
body = body.replace(/playsinline=/g, 'playsInline=');
body = body.replace(/preload=/g, 'preload=');
body = body.replace(/srcset=/g, 'srcSet=');
body = body.replace(/viewbox=/g, 'viewBox=');

// SVG attributes
body = body.replace(/fill-rule=/g, 'fillRule=');
body = body.replace(/clip-rule=/g, 'clipRule=');
body = body.replace(/stroke-width=/g, 'strokeWidth=');
body = body.replace(/stroke-linecap=/g, 'strokeLinecap=');
body = body.replace(/stroke-linejoin=/g, 'strokeLinejoin=');

// Style tags parsing (style="...")
body = body.replace(/style="([^"]*)"/g, (match, styles) => {
  const parts = styles.split(';').filter(s => s.trim());
  let obj = {};
  for (let p of parts) {
    const [key, val] = p.split(':');
    if (key && val) {
      const camelKey = key.trim().replace(/-([a-z])/g, g => g[1].toUpperCase());
      obj[camelKey] = val.trim();
    }
  }
  return `style={${JSON.stringify(obj)}}`;
});

// Self-closing tags
body = body.replace(/<img([^>]*?)(?<!\/)>/g, '<img$1 />');
body = body.replace(/<source([^>]*?)(?<!\/)>/g, '<source$1 />');
body = body.replace(/<input([^>]*?)(?<!\/)>/g, '<input$1 />');
body = body.replace(/<br([^>]*?)(?<!\/)>/g, '<br$1 />');
body = body.replace(/<hr([^>]*?)(?<!\/)>/g, '<hr$1 />');

// Replace img/ paths
body = body.replace(/(src|href|srcset)="((?:img|css|js)\/[^"]+)"/g, '$1="https://promo.atelieroptica.com.ar/$2"');

// Fix Glide.js attributes if needed
body = body.replace(/data-glide-el=/g, 'data-glide-el=');

// Fix unescaped < inside buttons or elements (e.g., <button ...><</button>)
// Glide arrows have < and > as text
body = body.replace(/>\s*<\s*<\/button>/g, '>&lt;</button>');
body = body.replace(/>\s*>\s*<\/button>/g, '>&gt;</button>');

const finalJsx = `
import './promo.css';
import Script from 'next/script';

export default function PromoLanding() {
  return (
    <>
      <div className="promo-wrapper" id="promo-wrapper">
        ${body}
      </div>

      <Script src="https://cdn.jsdelivr.net/npm/@glidejs/glide" strategy="beforeInteractive" />
      <Script id="init-glide" strategy="afterInteractive">
        {\`
          setTimeout(() => {
            if (window.Glide) {
              const sliderGlide = document.querySelector('#slider_glide');
              if (sliderGlide) {
                new window.Glide(sliderGlide, {
                  type: 'carousel',
                  perView: 1,
                  autoplay: 3000,
                  hoverpause: true,
                }).mount();
              }
              const reviewsGlide = document.querySelector('#reviews_glide');
              if (reviewsGlide) {
                new window.Glide(reviewsGlide, {
                  type: 'carousel',
                  perView: 3,
                  gap: 30,
                  autoplay: 4000,
                  hoverpause: true,
                  breakpoints: {
                    800: { perView: 2 },
                    480: { perView: 1 }
                  }
                }).mount();
              }
              const localesGlide = document.querySelector('#locales_glide');
              if (localesGlide) {
                new window.Glide(localesGlide, {
                  type: 'carousel',
                  perView: 4,
                  gap: 30,
                  autoplay: 5000,
                  hoverpause: true,
                  breakpoints: {
                    1024: { perView: 3 },
                    800: { perView: 2 },
                    480: { perView: 1 }
                  }
                }).mount();
              }
            }
          }, 1000);
        \`}
      </Script>
      <Script id="faq-accordion" strategy="afterInteractive">
        {\`
          setTimeout(() => {
            const accordionItemHeaders = document.querySelectorAll(".accordion-item-header");
            accordionItemHeaders.forEach(accordionItemHeader => {
              accordionItemHeader.addEventListener("click", event => {
                const currentlyActiveAccordionItemHeader = document.querySelector(".accordion-item-header.active");
                if (currentlyActiveAccordionItemHeader && currentlyActiveAccordionItemHeader !== accordionItemHeader) {
                  currentlyActiveAccordionItemHeader.classList.toggle("active");
                  currentlyActiveAccordionItemHeader.nextElementSibling.style.maxHeight = 0;
                }
                accordionItemHeader.classList.toggle("active");
                const accordionItemBody = accordionItemHeader.nextElementSibling;
                if (accordionItemHeader.classList.contains("active")) {
                  accordionItemBody.style.maxHeight = accordionItemBody.scrollHeight + "px";
                } else {
                  accordionItemBody.style.maxHeight = 0;
                }
              });
            });
          }, 1000);
        \`}
      </Script>
    </>
  );
}
`;

fs.writeFileSync('src/app/promo/page.tsx', finalJsx);
console.log("Converted successfully!");
