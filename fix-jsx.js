const fs = require('fs');
const path = require('path');

const files = [
  "src/components/contacts/ContactForm.tsx",
  "src/components/dashboard/GlobalBalanceReminders.tsx",
  "src/components/dashboard/GlobalLabReady.tsx",
  "src/components/dashboard/GlobalOpportunities.tsx",
  "src/components/dashboard/GlobalReviewRequests.tsx",
  "src/components/dashboard/GlobalTasks.tsx",
  "src/components/layout/Sidebar.tsx",
  "src/components/modals/TestChatModal.tsx",
  "src/components/ui/CommandPalette.tsx",
  "src/components/ui/FileDropZone.tsx"
];

const badStr = `role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}`;
const goodStr = `role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.currentTarget.click(); } }}`;

files.forEach(f => {
  const fullPath = path.join(process.cwd(), f);
  if (fs.existsSync(fullPath)) {
    let c = fs.readFileSync(fullPath, 'utf8');
    c = c.split(badStr).join(goodStr);
    fs.writeFileSync(fullPath, c);
  }
});
console.log('Fixed JSX duplicates');
