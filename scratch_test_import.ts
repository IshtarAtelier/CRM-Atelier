import { ContactService } from './src/services/contact.service';

async function test() {
    try {
        console.log('Testing ContactService import...');
        console.log('getAll:', typeof ContactService.getAll);
        console.log('Import successful');
    } catch (error) {
        console.error('Import failed:', error);
    }
}

test();
