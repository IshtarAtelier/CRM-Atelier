import { ContactService } from './src/services/contact.service';
async function test() {
  try {
    const contacts = await ContactService.getAll();
    console.log("Contacts count:", contacts.length);
  } catch(e) {
    console.error("Error calling getAll:", e);
  }
}
test();
