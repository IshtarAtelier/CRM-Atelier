/**
 * SmartLab Configuration & Mapping
 * Maps CRM values to SmartLab form field values
 */

// ── SmartLab URLs ─────────────────────────────
export const SMARTLAB_CONFIG = {
  loginUrl: 'https://grupooptico.dyndns.info/smartlab/auth/authSmartlab/login',
  newOrderUrl: 'https://grupooptico.dyndns.info/smartlab/laboratory/new',
  baseUrl: 'https://grupooptico.dyndns.info/smartlab',
  // Credentials from env
  email: process.env.SMARTLAB_EMAIL || '',
  password: process.env.SMARTLAB_PASSWORD || '',
};

// ── Lens Type Mapping CRM → SmartLab ──────────
export const LENS_TYPE_MAP: Record<string, string> = {
  'MONOFOCAL': 'Monofocal',
  'Cristal Monofocal': 'Monofocal',
  'MULTIFOCAL': 'Multifocal',
  'Cristal Multifocal': 'Multifocal',
  'BIFOCAL': 'Bifocal',
  'Cristal Bifocal': 'Bifocal',
  'OCUPACIONAL': 'Ocupacional',
  'Cristal Ocupacional': 'Ocupacional',
};

// ── Material/Index Mapping ────────────────────
export const MATERIAL_MAP: Record<string, string> = {
  '1.5': 'CR39 1.50',
  '1.56': 'Orgánico 1.56',
  '1.59': 'Policarbonato 1.59',
  '1.6': 'Orgánico 1.60',
  '1.67': 'Orgánico 1.67',
  '1.74': 'Orgánico 1.74',
  'Foto': 'Fotocromático',
};

// ── Treatment Mapping ─────────────────────────
export const TREATMENT_MAP: Record<string, string> = {
  'Antirreflejo': 'Antirreflejo',
  'Blue Cut': 'Blue Cut',
  'Antirreflejo + Blue Cut': 'Antirreflejo + Blue Cut',
  'Fotocromático': 'Fotocromático',
  'Ninguno': '',
};

// ── Color Mapping ─────────────────────────────
export const COLOR_MAP: Record<string, string> = {
  'Blanco': 'Blanco',
  'Fotocromático': 'Fotocromático',
  'Gris': 'Gris',
  'Marrón': 'Marrón',
  'Verde': 'Verde',
};

// ── Available options for UI dropdowns ─────────
export const SMARTLAB_OPTIONS = {
  colors: ['Blanco', 'Fotocromático', 'Gris', 'Marrón', 'Verde'],
  treatments: ['Ninguno', 'Antirreflejo', 'Blue Cut', 'Antirreflejo + Blue Cut', 'Fotocromático'],
  diameters: ['55', '60', '65', '70', '75', '80'],
};

// ── Validation: Required fields for SmartLab submission ──
export interface SmartLabPayload {
  // Identification
  patientName: string;
  sellerName: string;
  internalCode: string;                // CRM Order ID short
  
  // Lens type
  lensType: string;                    // Monofocal, Multifocal, etc.
  
  // Rx - Right Eye (OD)
  sphereOD: number | null;
  cylinderOD: number | null;
  axisOD: number | null;
  additionOD: number | null;           // Only for multifocal/bifocal
  
  // Rx - Left Eye (OI)
  sphereOI: number | null;
  cylinderOI: number | null;
  axisOI: number | null;
  additionOI: number | null;
  
  // Pupillary distance
  pdOD: string;
  pdOI: string;
  
  // Heights
  heightOD: string;
  heightOI: string;
  
  // Lens specs
  material: string;                    // Material/index
  color: string;
  treatment: string;
  diameter: string;
  
  // Frame measurements (optional)
  frameA: string;
  frameB: string;
  frameDbl: string;
  frameEdc: string;
  
  // Meta
  orderId: string;
  autoSubmit: boolean;                 // false = fill only, true = fill + submit
}

export interface SmartLabValidation {
  isValid: boolean;
  missingFields: string[];
  warnings: string[];
}

/**
 * Validates a SmartLab payload and returns missing/warning fields
 */
export function validateSmartLabPayload(payload: SmartLabPayload): SmartLabValidation {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!payload.patientName) missing.push('Nombre del paciente');
  if (!payload.lensType) missing.push('Tipo de lente');
  
  // At least one eye must have sphere value
  if (payload.sphereOD == null && payload.sphereOI == null) {
    missing.push('Graduación (al menos un ojo)');
  }
  
  // PD is important
  if (!payload.pdOD && !payload.pdOI) {
    missing.push('Distancia pupilar (DP)');
  }
  
  // Material
  if (!payload.material) missing.push('Material / Índice');
  
  // Color
  if (!payload.color) warnings.push('Color no especificado (se usará Blanco)');
  
  // Treatment  
  if (!payload.treatment) warnings.push('Tratamiento no especificado');
  
  // Diameter
  if (!payload.diameter) warnings.push('Diámetro no especificado');
  
  // Heights
  if (!payload.heightOD && !payload.heightOI) {
    warnings.push('Alturas no especificadas');
  }
  
  // Frame measurements
  if (!payload.frameA || !payload.frameB || !payload.frameDbl) {
    warnings.push('Medidas del armazón incompletas (A, B, DBL)');
  }
  
  // Addition for multifocal
  if (['Multifocal', 'Bifocal', 'Ocupacional'].includes(payload.lensType)) {
    if (payload.additionOD == null && payload.additionOI == null) {
      missing.push('Adición (requerida para ' + payload.lensType + ')');
    }
  }

  return {
    isValid: missing.length === 0,
    missingFields: missing,
    warnings,
  };
}

/**
 * Formats a sphere/cylinder value for display (+/- prefix, 2 decimals)
 */
export function formatDiopter(value: number | null | undefined): string {
  if (value == null) return '';
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}
