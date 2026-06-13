const fs = require('fs');
const content = fs.readFileSync("/Users/ishtarpissano/.gemini/antigravity/brain/623961af-513c-49e6-b31d-d37c2d1ecdc4/.system_generated/steps/408/content.md", "utf8");
const match = content.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
if (match) {
  const data = JSON.parse(match[1]);
  const widgets = data.props.pageProps.data.widgets;
  let result = "";
  widgets.forEach(w => {
    if (w.widgetName === 'LXFaqGroup' || w.widgetName === 'LXFaqGrid' || w.widgetName === 'FaqGrid' || w.widgetName.includes('Faq')) {
      if (w.widgetValue && Array.isArray(w.widgetValue)) {
         w.widgetValue.forEach(v => {
             if (v.faqItems && Array.isArray(v.faqItems)) {
                 v.faqItems.forEach(item => {
                     result += `Q: ${item.teaserTitle}\nA: ${item.teaserText}\n\n`;
                 });
             }
         });
      }
    }
  });
  if(result) {
      fs.writeFileSync("extracted_faqs.txt", result);
  } else {
      // Just dump all string values that look like questions
      fs.writeFileSync("extracted_faqs.json", JSON.stringify(widgets, null, 2));
  }
}
