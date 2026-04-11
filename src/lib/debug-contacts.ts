const { ContactService } = require('./src/services/contact.service');

async function debug() {
    try {
        console.log('Testing ContactService.getAll()...');
        const contacts = await ContactService.getAll();
        console.log(`Success! Found ${contacts.length} contacts.`);
    } catch (error) {
        console.error('CRASH DETECTED:');
        console.error(error);
    }
}

debug();
