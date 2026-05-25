import { google } from 'googleapis';
import { prisma } from '@/lib/db';

export class GoogleContactsService {
    private static getOAuthClient() {
        const clientId = process.env.GOOGLE_CONTACTS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CONTACTS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
        
        // El Redirect URI debe coincidir exactamente con el configurado en Google Cloud Console
        // Usamos una URL relativa que Google no permite, por lo que requeriremos que sea absoluta.
        // Asumimos que la app corre en un dominio conocido, o permitimos que se sobreescriba en env.
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const redirectUri = `${baseUrl}/api/admin/google/callback`;

        return new google.auth.OAuth2(
            clientId,
            clientSecret,
            redirectUri
        );
    }

    public static async getAuthUrl() {
        const oauth2Client = this.getOAuthClient();
        return oauth2Client.generateAuthUrl({
            access_type: 'offline', // Para obtener el refresh_token
            scope: ['https://www.googleapis.com/auth/contacts'],
            prompt: 'consent' // Fuerza a preguntar siempre y devolver el refresh token
        });
    }

    public static async handleCallback(code: string) {
        const oauth2Client = this.getOAuthClient();
        const { tokens } = await oauth2Client.getToken(code);
        
        if (tokens.refresh_token) {
            // Guardamos el refresh_token en la base de datos
            await prisma.systemSetting.upsert({
                where: { key: 'GOOGLE_CONTACTS_REFRESH_TOKEN' },
                update: { value: tokens.refresh_token },
                create: { key: 'GOOGLE_CONTACTS_REFRESH_TOKEN', value: tokens.refresh_token }
            });
            return true;
        }
        return false;
    }

    private static async getAuthenticatedClient() {
        const setting = await prisma.systemSetting.findUnique({
            where: { key: 'GOOGLE_CONTACTS_REFRESH_TOKEN' }
        });

        if (!setting || !setting.value) {
            return null;
        }

        const oauth2Client = this.getOAuthClient();
        oauth2Client.setCredentials({ refresh_token: setting.value });
        return oauth2Client;
    }

    /**
     * Sincroniza un cliente a Google Contacts
     * @param clientData Datos del cliente a crear o actualizar
     */
    public static async syncClient(clientData: { name: string; phone?: string | null; email?: string | null }) {
        try {
            const auth = await this.getAuthenticatedClient();
            if (!auth) {
                console.log('[GoogleContactsService] No refresh token found. Skipping sync.');
                return;
            }

            const service = google.people({ version: 'v1', auth });

            const contactBody: any = {
                names: [{ givenName: `Cliente ${clientData.name}` }],
            };

            if (clientData.phone) {
                contactBody.phoneNumbers = [{ value: clientData.phone }];
            }

            if (clientData.email) {
                contactBody.emailAddresses = [{ value: clientData.email }];
            }

            const res = await service.people.createContact({
                requestBody: contactBody
            });

            console.log(`[GoogleContactsService] Sincronizado con éxito: ${clientData.name} -> ${res.data.resourceName}`);
            return res.data;
        } catch (error) {
            console.error('[GoogleContactsService] Error sincronizando cliente:', error);
            // No hacemos un throw para no frenar la creación del cliente en el CRM
        }
    }
}
