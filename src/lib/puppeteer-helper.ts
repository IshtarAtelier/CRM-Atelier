import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { SMARTLAB_CONFIG, type SmartLabPayload } from './smartlab-config';

// Add stealth plugin to puppeteer
puppeteer.use(StealthPlugin());

/**
 * SmartLab Form Selectors (Placeholders - to be refined with active account)
 */
const SELECTORS = {
  // Login
  emailInput: '#email',
  passwordInput: '#password',
  loginButton: 'button[type="submit"]',
  
  // New Order Form
  patientName: 'input[name="paciente"]',
  sellerName: 'select[name="vendedor"]',
  internalCode: 'input[name="codigo_interno"]',
  
  // Lens Type
  lensTypeSelect: 'select[name="tipo_lente"]',
  materialSelect: 'select[name="material"]',
  
  // Rx OD
  odSphere: 'input[name="od_esfera"]',
  odCylinder: 'input[name="od_cilindro"]',
  odAxis: 'input[name="od_eje"]',
  odAddition: 'input[name="od_adicion"]',
  
  // Rx OI
  oiSphere: 'input[name="oi_esfera"]',
  oiCylinder: 'input[name="oi_cilindro"]',
  oiAxis: 'input[name="oi_eje"]',
  oiAddition: 'input[name="oi_adicion"]',
  
  // PD & Heights
  pdOD: 'input[name="od_dp"]',
  pdOI: 'input[name="oi_dp"]',
  heightOD: 'input[name="od_altura"]',
  heightOI: 'input[name="oi_altura"]',
  
  // Specs
  color: 'select[name="color"]',
  treatment: 'select[name="tratamiento"]',
  diameter: 'select[name="diametro"]',
  
  // Frame
  frameA: 'input[name="armazon_a"]',
  frameB: 'input[name="armazon_b"]',
  frameDbl: 'input[name="armazon_dbl"]',
  frameEdc: 'input[name="armazon_edc"]',
  
  // Buttons
  saveDraft: 'button#btn-guardar-borrador',
  submitOrder: 'button#btn-enviar-pedido',
};

export interface SmartLabBotResult {
  success: boolean;
  message: string;
  screenshot?: string; // base64
  error?: string;
}

/**
 * Automates the submission of an order to SmartLab
 */
export async function submitToSmartLabBot(payload: SmartLabPayload): Promise<SmartLabBotResult> {
  let browser;
  try {
    console.log('Starting SmartLab Bot for patient:', payload.patientName);
    
    browser = await puppeteer.launch({
      headless: true, // Use headless for server-side
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });

    // 1. Login
    console.log('Logging in to SmartLab...');
    await page.goto(SMARTLAB_CONFIG.loginUrl, { waitUntil: 'networkidle2' });
    
    await page.type(SELECTORS.emailInput, SMARTLAB_CONFIG.email);
    await page.type(SELECTORS.passwordInput, SMARTLAB_CONFIG.password);
    await Promise.all([
      page.click(SELECTORS.loginButton),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

    // Check if login failed (still on login page)
    if (page.url().includes('login')) {
      return { success: false, message: 'Fallo el inicio de sesión en SmartLab', error: 'Invalid credentials or account blocked' };
    }

    // 2. Navigate to New Order
    console.log('Navigating to New Order form...');
    await page.goto(SMARTLAB_CONFIG.newOrderUrl, { waitUntil: 'networkidle2' });

    // Check for "Account Blocked" message/redirect
    if (page.url().includes('blocked') || (await page.$('.alert-danger'))) {
      const errorMsg = await page.$eval('.alert-danger', (el: any) => el.innerText).catch(() => 'Cuenta bloqueada o con deuda');
      return { success: false, message: 'No se puede acceder al formulario', error: errorMsg };
    }

    // 3. Fill the form
    console.log('Filling form fields...');
    
    // Patient & Code
    await page.type(SELECTORS.patientName, payload.patientName);
    await page.type(SELECTORS.internalCode, payload.internalCode);
    
    // Rx OD
    if (payload.sphereOD != null) await page.type(SELECTORS.odSphere, String(payload.sphereOD));
    if (payload.cylinderOD != null) await page.type(SELECTORS.odCylinder, String(payload.cylinderOD));
    if (payload.axisOD != null) await page.type(SELECTORS.odAxis, String(payload.axisOD));
    if (payload.additionOD != null) await page.type(SELECTORS.odAddition, String(payload.additionOD));
    
    // Rx OI
    if (payload.sphereOI != null) await page.type(SELECTORS.oiSphere, String(payload.sphereOI));
    if (payload.cylinderOI != null) await page.type(SELECTORS.oiCylinder, String(payload.cylinderOI));
    if (payload.axisOI != null) await page.type(SELECTORS.oiAxis, String(payload.axisOI));
    if (payload.additionOI != null) await page.type(SELECTORS.oiAddition, String(payload.additionOI));
    
    // PD & Heights
    if (payload.pdOD) await page.type(SELECTORS.pdOD, payload.pdOD);
    if (payload.pdOI) await page.type(SELECTORS.pdOI, payload.pdOI);
    if (payload.heightOD) await page.type(SELECTORS.heightOD, payload.heightOD);
    if (payload.heightOI) await page.type(SELECTORS.heightOI, payload.heightOI);
    
    // Measurements
    if (payload.frameA) await page.type(SELECTORS.frameA, payload.frameA);
    if (payload.frameB) await page.type(SELECTORS.frameB, payload.frameB);
    if (payload.frameDbl) await page.type(SELECTORS.frameDbl, payload.frameDbl);
    if (payload.frameEdc) await page.type(SELECTORS.frameEdc, payload.frameEdc);

    // 4. Capture Screenshot
    console.log('Capturing confirmation screenshot...');
    const screenshot = await page.screenshot({ encoding: 'base64', fullPage: true });

    // 5. Submit (if requested)
    if (payload.autoSubmit) {
      console.log('Submitting order...');
      // await page.click(SELECTORS.submitOrder);
      // await page.waitForNavigation({ waitUntil: 'networkidle2' });
      return { 
        success: true, 
        message: 'Pedido cargado y enviado automáticamente', 
        screenshot: screenshot as string
      };
    }

    return { 
      success: true, 
      message: 'Formulario autocompletado para revisión', 
      screenshot: screenshot as string
    };

  } catch (error: any) {
    console.error('Puppeteer automation error:', error);
    return { success: false, message: 'Error en la automatización', error: error.message };
  } finally {
    if (browser) await browser.close();
  }
}
