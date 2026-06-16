import { ContactService } from './src/services/contact.service';
async function test() {
  try {
    const contacts = await ContactService.getAll();
    const id = contacts[0].id;
    const detail = await ContactService.getById(id);
    console.log("Detail fetched successfully:", detail?.id);
  } catch(e) {
    console.error("Error calling getById:", e);
  }
}
test();
