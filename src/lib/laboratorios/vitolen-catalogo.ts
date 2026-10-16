// GENERADO por scripts/maintenance/precios-vitolen/generar-catalogo-ts.mjs
// a partir de LISTA_DE_PRECIOS_HOYA_PENTAX_96-original.pdf (6 páginas) (lista L96 - V28 - ARG 09/2026). NO editar a mano:
// regenerar con `node scripts/maintenance/precios-vitolen/generar-catalogo-ts.mjs`.
//
// Cada cristal de Vitolen cargado en el sistema, con su código de producto en
// el portal, para que la carga asistida encuentre el material por el nombre
// exacto del producto.

export interface CristalVitolen {
    nombre: string;
    linea: string;
    diseno: string;
    tipo: string;
    material: string;
    indice: string;
    codigos: string[];
    variantes: string[];
    sinAntirreflejo: boolean;
    /** Precio de lista por par, sin IVA, con antirreflejo (L96); null si la lista no lo trae. */
    precioLista: number | null;
}

export const LISTA_VITOLEN = "L96 - V28 - ARG 09/2026";

export const CATALOGO_VITOLEN: CristalVitolen[] = [
    {
        "nombre": "HOYA LIFESTYLE 4 - 1.50 CLEAR",
        "linea": "lifestyle-4",
        "diseno": "iD LifeStyle 4",
        "tipo": "Cristal Multifocal",
        "material": "1.50 CLEAR",
        "indice": "1.50",
        "codigos": [
            "11000",
            "11050",
            "11100"
        ],
        "variantes": [
            "Urban",
            "Indoor",
            "Outdoor"
        ],
        "sinAntirreflejo": false,
        "precioLista": 514200
    },
    {
        "nombre": "HOYA LIFESTYLE 4 - 1.50 SENSITY 2",
        "linea": "lifestyle-4",
        "diseno": "iD LifeStyle 4",
        "tipo": "Cristal Multifocal",
        "material": "1.50 SENSITY 2",
        "indice": "1.50",
        "codigos": [
            "11002",
            "11052",
            "11102"
        ],
        "variantes": [
            "Urban",
            "Indoor",
            "Outdoor"
        ],
        "sinAntirreflejo": false,
        "precioLista": 726800
    },
    {
        "nombre": "HOYA ARRAY 2 - 1.50 CLEAR BLUE FILTER",
        "linea": "array-2",
        "diseno": "Array 2",
        "tipo": "Cristal Multifocal",
        "material": "1.50 CLEAR BLUE FILTER",
        "indice": "1.50",
        "codigos": [
            "10050"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 428000
    },
    {
        "nombre": "HOYA ARRAY 2 - 1.50 SENSITY 2",
        "linea": "array-2",
        "diseno": "Array 2",
        "tipo": "Cristal Multifocal",
        "material": "1.50 SENSITY 2",
        "indice": "1.50",
        "codigos": [
            "10052"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 612600
    },
    {
        "nombre": "HOYA ARRAY 2 - 1.59 CLEAR BLUE FILTER",
        "linea": "array-2",
        "diseno": "Array 2",
        "tipo": "Cristal Multifocal",
        "material": "1.59 CLEAR BLUE FILTER",
        "indice": "1.59",
        "codigos": [
            "10060"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 432800
    },
    {
        "nombre": "HOYA ARRAY 2 - 1.59 SENSITY 2",
        "linea": "array-2",
        "diseno": "Array 2",
        "tipo": "Cristal Multifocal",
        "material": "1.59 SENSITY 2",
        "indice": "1.59",
        "codigos": [
            "10062"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 663000
    },
    {
        "nombre": "HOYA ARRAY 2 - 1.59 POLARIZED",
        "linea": "array-2",
        "diseno": "Array 2",
        "tipo": "Cristal Multifocal",
        "material": "1.59 POLARIZED",
        "indice": "1.59",
        "codigos": [
            "10064/66/68"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 500800
    },
    {
        "nombre": "HOYA ARRAY 2 - 1.60 CLEAR",
        "linea": "array-2",
        "diseno": "Array 2",
        "tipo": "Cristal Multifocal",
        "material": "1.60 CLEAR",
        "indice": "1.60",
        "codigos": [
            "10070"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 432800
    },
    {
        "nombre": "HOYA ARRAY 2 - 1.60 BLUE FILTER UV-420",
        "linea": "array-2",
        "diseno": "Array 2",
        "tipo": "Cristal Multifocal",
        "material": "1.60 BLUE FILTER UV-420",
        "indice": "1.60",
        "codigos": [
            "10072"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 457200
    },
    {
        "nombre": "HOYA ARRAY 2 - 1.60 SENSITY 2",
        "linea": "array-2",
        "diseno": "Array 2",
        "tipo": "Cristal Multifocal",
        "material": "1.60 SENSITY 2",
        "indice": "1.60",
        "codigos": [
            "10074/76/78"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 694600
    },
    {
        "nombre": "HOYA ARRAY 2 - 1.67 CLEAR",
        "linea": "array-2",
        "diseno": "Array 2",
        "tipo": "Cristal Multifocal",
        "material": "1.67 CLEAR",
        "indice": "1.67",
        "codigos": [
            "10080"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 466200
    },
    {
        "nombre": "HOYA ARRAY 2 - 1.67 CLEAR BLUE FILTER",
        "linea": "array-2",
        "diseno": "Array 2",
        "tipo": "Cristal Multifocal",
        "material": "1.67 CLEAR BLUE FILTER",
        "indice": "1.67",
        "codigos": [
            "10082"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 505600
    },
    {
        "nombre": "HOYA ARRAY 2 - 1.67 SENSITY 2",
        "linea": "array-2",
        "diseno": "Array 2",
        "tipo": "Cristal Multifocal",
        "material": "1.67 SENSITY 2",
        "indice": "1.67",
        "codigos": [
            "10084"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 751000
    },
    {
        "nombre": "HOYA ARRAY 2 - 1.74 CLEAR",
        "linea": "array-2",
        "diseno": "Array 2",
        "tipo": "Cristal Multifocal",
        "material": "1.74 CLEAR",
        "indice": "1.74",
        "codigos": [
            "10086"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 608000
    },
    {
        "nombre": "HOYA SUMMIT - 1.50 CLEAR BLUE FILTER",
        "linea": "summit",
        "diseno": "Summit Premium",
        "tipo": "Cristal Multifocal",
        "material": "1.50 CLEAR BLUE FILTER",
        "indice": "1.50",
        "codigos": [
            "10150"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 373800
    },
    {
        "nombre": "HOYA SUMMIT - 1.50 SENSITY 2",
        "linea": "summit",
        "diseno": "Summit Premium",
        "tipo": "Cristal Multifocal",
        "material": "1.50 SENSITY 2",
        "indice": "1.50",
        "codigos": [
            "10152"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 544000
    },
    {
        "nombre": "HOYA SUMMIT - 1.50 POLARIZED",
        "linea": "summit",
        "diseno": "Summit Premium",
        "tipo": "Cristal Multifocal",
        "material": "1.50 POLARIZED",
        "indice": "1.50",
        "codigos": [
            "10154/56"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 407800
    },
    {
        "nombre": "HOYA SUMMIT - 1.59 CLEAR BLUE FILTER",
        "linea": "summit",
        "diseno": "Summit Premium",
        "tipo": "Cristal Multifocal",
        "material": "1.59 CLEAR BLUE FILTER",
        "indice": "1.59",
        "codigos": [
            "10160"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 383600
    },
    {
        "nombre": "HOYA SUMMIT - 1.59 SENSITY 2",
        "linea": "summit",
        "diseno": "Summit Premium",
        "tipo": "Cristal Multifocal",
        "material": "1.59 SENSITY 2",
        "indice": "1.59",
        "codigos": [
            "10162"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 584000
    },
    {
        "nombre": "HOYA SUMMIT - 1.59 POLARIZED",
        "linea": "summit",
        "diseno": "Summit Premium",
        "tipo": "Cristal Multifocal",
        "material": "1.59 POLARIZED",
        "indice": "1.59",
        "codigos": [
            "10164/66/68"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 445800
    },
    {
        "nombre": "HOYA SUMMIT - 1.60 CLEAR",
        "linea": "summit",
        "diseno": "Summit Premium",
        "tipo": "Cristal Multifocal",
        "material": "1.60 CLEAR",
        "indice": "1.60",
        "codigos": [
            "10170"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 383600
    },
    {
        "nombre": "HOYA SUMMIT - 1.60 BLUE FILTER UV-420",
        "linea": "summit",
        "diseno": "Summit Premium",
        "tipo": "Cristal Multifocal",
        "material": "1.60 BLUE FILTER UV-420",
        "indice": "1.60",
        "codigos": [
            "10172"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 404000
    },
    {
        "nombre": "HOYA SUMMIT - 1.60 SENSITY 2",
        "linea": "summit",
        "diseno": "Summit Premium",
        "tipo": "Cristal Multifocal",
        "material": "1.60 SENSITY 2",
        "indice": "1.60",
        "codigos": [
            "10174/76/78"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 607600
    },
    {
        "nombre": "HOYA SUMMIT - 1.67 CLEAR",
        "linea": "summit",
        "diseno": "Summit Premium",
        "tipo": "Cristal Multifocal",
        "material": "1.67 CLEAR",
        "indice": "1.67",
        "codigos": [
            "10180"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 393600
    },
    {
        "nombre": "HOYA SUMMIT - 1.67 CLEAR BLUE FILTER",
        "linea": "summit",
        "diseno": "Summit Premium",
        "tipo": "Cristal Multifocal",
        "material": "1.67 CLEAR BLUE FILTER",
        "indice": "1.67",
        "codigos": [
            "10182"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 450200
    },
    {
        "nombre": "HOYA SUMMIT - 1.67 SENSITY 2",
        "linea": "summit",
        "diseno": "Summit Premium",
        "tipo": "Cristal Multifocal",
        "material": "1.67 SENSITY 2",
        "indice": "1.67",
        "codigos": [
            "10184"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 651200
    },
    {
        "nombre": "HOYA SUMMIT - 1.74 CLEAR",
        "linea": "summit",
        "diseno": "Summit Premium",
        "tipo": "Cristal Multifocal",
        "material": "1.74 CLEAR",
        "indice": "1.74",
        "codigos": [
            "10186"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 560200
    },
    {
        "nombre": "HOYA ARGOS - 1.50 CLEAR",
        "linea": "argos",
        "diseno": "Argos BKS",
        "tipo": "Cristal Multifocal",
        "material": "1.50 CLEAR",
        "indice": "1.50",
        "codigos": [
            "10000"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 292800
    },
    {
        "nombre": "HOYA ARGOS - 1.50 CLEAR BLUE FILTER",
        "linea": "argos",
        "diseno": "Argos BKS",
        "tipo": "Cristal Multifocal",
        "material": "1.50 CLEAR BLUE FILTER",
        "indice": "1.50",
        "codigos": [
            "10002"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 326400
    },
    {
        "nombre": "HOYA ARGOS - 1.50 SENSITY 2",
        "linea": "argos",
        "diseno": "Argos BKS",
        "tipo": "Cristal Multifocal",
        "material": "1.50 SENSITY 2",
        "indice": "1.50",
        "codigos": [
            "10004"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 492800
    },
    {
        "nombre": "HOYA ARGOS - 1.50 POLARIZED",
        "linea": "argos",
        "diseno": "Argos BKS",
        "tipo": "Cristal Multifocal",
        "material": "1.50 POLARIZED",
        "indice": "1.50",
        "codigos": [
            "10006/08"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 385800
    },
    {
        "nombre": "HOYA ARGOS - 1.59 CLEAR",
        "linea": "argos",
        "diseno": "Argos BKS",
        "tipo": "Cristal Multifocal",
        "material": "1.59 CLEAR",
        "indice": "1.59",
        "codigos": [
            "10010"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 296000
    },
    {
        "nombre": "HOYA ARGOS - 1.59 CLEAR BLUE FILTER",
        "linea": "argos",
        "diseno": "Argos BKS",
        "tipo": "Cristal Multifocal",
        "material": "1.59 CLEAR BLUE FILTER",
        "indice": "1.59",
        "codigos": [
            "10012"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 342000
    },
    {
        "nombre": "HOYA ARGOS - 1.59 SENSITY 2",
        "linea": "argos",
        "diseno": "Argos BKS",
        "tipo": "Cristal Multifocal",
        "material": "1.59 SENSITY 2",
        "indice": "1.59",
        "codigos": [
            "10014"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 524800
    },
    {
        "nombre": "HOYA ARGOS - 1.60 CLEAR",
        "linea": "argos",
        "diseno": "Argos BKS",
        "tipo": "Cristal Multifocal",
        "material": "1.60 CLEAR",
        "indice": "1.60",
        "codigos": [
            "10022"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 342000
    },
    {
        "nombre": "HOYA ARGOS - 1.60 BLUE FILTER UV-420",
        "linea": "argos",
        "diseno": "Argos BKS",
        "tipo": "Cristal Multifocal",
        "material": "1.60 BLUE FILTER UV-420",
        "indice": "1.60",
        "codigos": [
            "10024"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 360200
    },
    {
        "nombre": "HOYA ARGOS - 1.60 SENSITY 2",
        "linea": "argos",
        "diseno": "Argos BKS",
        "tipo": "Cristal Multifocal",
        "material": "1.60 SENSITY 2",
        "indice": "1.60",
        "codigos": [
            "10026/28/30"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 553800
    },
    {
        "nombre": "MI PRIMER HOYA ARRAY 2 - 1.50 CLEAR BLUE FILTER",
        "linea": "mph-array-2",
        "diseno": "Mi Primer Hoya (Array 2)",
        "tipo": "Cristal Multifocal",
        "material": "1.50 CLEAR BLUE FILTER",
        "indice": "1.50",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 214600
    },
    {
        "nombre": "MI PRIMER HOYA ARRAY 2 - 1.50 SENSITY 2",
        "linea": "mph-array-2",
        "diseno": "Mi Primer Hoya (Array 2)",
        "tipo": "Cristal Multifocal",
        "material": "1.50 SENSITY 2",
        "indice": "1.50",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 307000
    },
    {
        "nombre": "MI PRIMER HOYA ARRAY 2 - 1.59 CLEAR BLUE FILTER",
        "linea": "mph-array-2",
        "diseno": "Mi Primer Hoya (Array 2)",
        "tipo": "Cristal Multifocal",
        "material": "1.59 CLEAR BLUE FILTER",
        "indice": "1.59",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 217000
    },
    {
        "nombre": "MI PRIMER HOYA ARRAY 2 - 1.59 SENSITY 2",
        "linea": "mph-array-2",
        "diseno": "Mi Primer Hoya (Array 2)",
        "tipo": "Cristal Multifocal",
        "material": "1.59 SENSITY 2",
        "indice": "1.59",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 332200
    },
    {
        "nombre": "MI PRIMER HOYA ARRAY 2 - 1.59 POLARIZED",
        "linea": "mph-array-2",
        "diseno": "Mi Primer Hoya (Array 2)",
        "tipo": "Cristal Multifocal",
        "material": "1.59 POLARIZED",
        "indice": "1.59",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 251000
    },
    {
        "nombre": "MI PRIMER HOYA ARRAY 2 - 1.60 CLEAR",
        "linea": "mph-array-2",
        "diseno": "Mi Primer Hoya (Array 2)",
        "tipo": "Cristal Multifocal",
        "material": "1.60 CLEAR",
        "indice": "1.60",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 217000
    },
    {
        "nombre": "MI PRIMER HOYA ARRAY 2 - 1.60 BLUE FILTER UV-420",
        "linea": "mph-array-2",
        "diseno": "Mi Primer Hoya (Array 2)",
        "tipo": "Cristal Multifocal",
        "material": "1.60 BLUE FILTER UV-420",
        "indice": "1.60",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 229200
    },
    {
        "nombre": "MI PRIMER HOYA ARRAY 2 - 1.60 SENSITY 2",
        "linea": "mph-array-2",
        "diseno": "Mi Primer Hoya (Array 2)",
        "tipo": "Cristal Multifocal",
        "material": "1.60 SENSITY 2",
        "indice": "1.60",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 348000
    },
    {
        "nombre": "MI PRIMER HOYA SUMMIT - 1.50 CLEAR BLUE FILTER",
        "linea": "mph-summit",
        "diseno": "Mi Primer Hoya (Summit)",
        "tipo": "Cristal Multifocal",
        "material": "1.50 CLEAR BLUE FILTER",
        "indice": "1.50",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 187600
    },
    {
        "nombre": "MI PRIMER HOYA SUMMIT - 1.50 SENSITY 2",
        "linea": "mph-summit",
        "diseno": "Mi Primer Hoya (Summit)",
        "tipo": "Cristal Multifocal",
        "material": "1.50 SENSITY 2",
        "indice": "1.50",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 272600
    },
    {
        "nombre": "MI PRIMER HOYA SUMMIT - 1.59 CLEAR BLUE FILTER",
        "linea": "mph-summit",
        "diseno": "Mi Primer Hoya (Summit)",
        "tipo": "Cristal Multifocal",
        "material": "1.59 CLEAR BLUE FILTER",
        "indice": "1.59",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 192400
    },
    {
        "nombre": "MI PRIMER HOYA SUMMIT - 1.59 SENSITY 2",
        "linea": "mph-summit",
        "diseno": "Mi Primer Hoya (Summit)",
        "tipo": "Cristal Multifocal",
        "material": "1.59 SENSITY 2",
        "indice": "1.59",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 292600
    },
    {
        "nombre": "MI PRIMER HOYA SUMMIT - 1.59 POLARIZED",
        "linea": "mph-summit",
        "diseno": "Mi Primer Hoya (Summit)",
        "tipo": "Cristal Multifocal",
        "material": "1.59 POLARIZED",
        "indice": "1.59",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 223600
    },
    {
        "nombre": "MI PRIMER HOYA SUMMIT - 1.60 CLEAR",
        "linea": "mph-summit",
        "diseno": "Mi Primer Hoya (Summit)",
        "tipo": "Cristal Multifocal",
        "material": "1.60 CLEAR",
        "indice": "1.60",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 192400
    },
    {
        "nombre": "MI PRIMER HOYA SUMMIT - 1.60 BLUE FILTER UV-420",
        "linea": "mph-summit",
        "diseno": "Mi Primer Hoya (Summit)",
        "tipo": "Cristal Multifocal",
        "material": "1.60 BLUE FILTER UV-420",
        "indice": "1.60",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 202600
    },
    {
        "nombre": "MI PRIMER HOYA SUMMIT - 1.60 SENSITY 2",
        "linea": "mph-summit",
        "diseno": "Mi Primer Hoya (Summit)",
        "tipo": "Cristal Multifocal",
        "material": "1.60 SENSITY 2",
        "indice": "1.60",
        "codigos": [],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 304400
    },
    {
        "nombre": "HOYA TACT BKS - 1.50 CLEAR BLUE FILTER",
        "linea": "tact",
        "diseno": "Tact BKS",
        "tipo": "Cristal Ocupacional",
        "material": "1.50 CLEAR BLUE FILTER",
        "indice": "1.50",
        "codigos": [
            "10200",
            "10250"
        ],
        "variantes": [
            "40",
            "60"
        ],
        "sinAntirreflejo": false,
        "precioLista": 197000
    },
    {
        "nombre": "HOYA TACT BKS - 1.50 SENSITY 2",
        "linea": "tact",
        "diseno": "Tact BKS",
        "tipo": "Cristal Ocupacional",
        "material": "1.50 SENSITY 2",
        "indice": "1.50",
        "codigos": [
            "10202",
            "10252"
        ],
        "variantes": [
            "40",
            "60"
        ],
        "sinAntirreflejo": false,
        "precioLista": 346800
    },
    {
        "nombre": "HOYA TACT BKS - 1.59 CLEAR BLUE FILTER",
        "linea": "tact",
        "diseno": "Tact BKS",
        "tipo": "Cristal Ocupacional",
        "material": "1.59 CLEAR BLUE FILTER",
        "indice": "1.59",
        "codigos": [
            "10206",
            "10256"
        ],
        "variantes": [
            "40",
            "60"
        ],
        "sinAntirreflejo": false,
        "precioLista": 200800
    },
    {
        "nombre": "HOYA TACT BKS - 1.59 SENSITY 2",
        "linea": "tact",
        "diseno": "Tact BKS",
        "tipo": "Cristal Ocupacional",
        "material": "1.59 SENSITY 2",
        "indice": "1.59",
        "codigos": [
            "10208",
            "10258"
        ],
        "variantes": [
            "40",
            "60"
        ],
        "sinAntirreflejo": false,
        "precioLista": 386000
    },
    {
        "nombre": "HOYA TACT BKS - 1.60 CLEAR",
        "linea": "tact",
        "diseno": "Tact BKS",
        "tipo": "Cristal Ocupacional",
        "material": "1.60 CLEAR",
        "indice": "1.60",
        "codigos": [
            "10210",
            "10260"
        ],
        "variantes": [
            "40",
            "60"
        ],
        "sinAntirreflejo": false,
        "precioLista": 200800
    },
    {
        "nombre": "HOYA TACT BKS - 1.60 BLUE FILTER UV-420",
        "linea": "tact",
        "diseno": "Tact BKS",
        "tipo": "Cristal Ocupacional",
        "material": "1.60 BLUE FILTER UV-420",
        "indice": "1.60",
        "codigos": [
            "10212",
            "10262"
        ],
        "variantes": [
            "40",
            "60"
        ],
        "sinAntirreflejo": false,
        "precioLista": 216600
    },
    {
        "nombre": "HOYA TACT BKS - 1.60 SENSITY 2",
        "linea": "tact",
        "diseno": "Tact BKS",
        "tipo": "Cristal Ocupacional",
        "material": "1.60 SENSITY 2",
        "indice": "1.60",
        "codigos": [
            "10214/16/18",
            "10264/66/68"
        ],
        "variantes": [
            "40",
            "60"
        ],
        "sinAntirreflejo": false,
        "precioLista": 409000
    },
    {
        "nombre": "HOYA TACT BKS - 1.67 CLEAR",
        "linea": "tact",
        "diseno": "Tact BKS",
        "tipo": "Cristal Ocupacional",
        "material": "1.67 CLEAR",
        "indice": "1.67",
        "codigos": [
            "10219",
            "10269"
        ],
        "variantes": [
            "40",
            "60"
        ],
        "sinAntirreflejo": false,
        "precioLista": 281600
    },
    {
        "nombre": "HOYA TACT BKS - 1.67 CLEAR BLUE FILTER",
        "linea": "tact",
        "diseno": "Tact BKS",
        "tipo": "Cristal Ocupacional",
        "material": "1.67 CLEAR BLUE FILTER",
        "indice": "1.67",
        "codigos": [
            "10220",
            "10270"
        ],
        "variantes": [
            "40",
            "60"
        ],
        "sinAntirreflejo": false,
        "precioLista": 318400
    },
    {
        "nombre": "HOYA NULUX IDENTITY V+ - 1.50 CLEAR BLUE FILTER",
        "linea": "nulux",
        "diseno": "Nulux Identity V+",
        "tipo": "Cristal Monofocal",
        "material": "1.50 CLEAR BLUE FILTER",
        "indice": "1.50",
        "codigos": [
            "10450"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 142800
    },
    {
        "nombre": "HOYA NULUX IDENTITY V+ - 1.50 SENSITY 2",
        "linea": "nulux",
        "diseno": "Nulux Identity V+",
        "tipo": "Cristal Monofocal",
        "material": "1.50 SENSITY 2",
        "indice": "1.50",
        "codigos": [
            "10452"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 246600
    },
    {
        "nombre": "HOYA NULUX IDENTITY V+ - 1.50 POLARIZED",
        "linea": "nulux",
        "diseno": "Nulux Identity V+",
        "tipo": "Cristal Monofocal",
        "material": "1.50 POLARIZED",
        "indice": "1.50",
        "codigos": [
            "10454/56"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 208400
    },
    {
        "nombre": "HOYA NULUX IDENTITY V+ - 1.59 CLEAR BLUE FILTER",
        "linea": "nulux",
        "diseno": "Nulux Identity V+",
        "tipo": "Cristal Monofocal",
        "material": "1.59 CLEAR BLUE FILTER",
        "indice": "1.59",
        "codigos": [
            "10460"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 145800
    },
    {
        "nombre": "HOYA NULUX IDENTITY V+ - 1.59 SENSITY 2",
        "linea": "nulux",
        "diseno": "Nulux Identity V+",
        "tipo": "Cristal Monofocal",
        "material": "1.59 SENSITY 2",
        "indice": "1.59",
        "codigos": [
            "10462"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 295600
    },
    {
        "nombre": "HOYA NULUX IDENTITY V+ - 1.59 POLARIZED",
        "linea": "nulux",
        "diseno": "Nulux Identity V+",
        "tipo": "Cristal Monofocal",
        "material": "1.59 POLARIZED",
        "indice": "1.59",
        "codigos": [
            "10464/66/68"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 255800
    },
    {
        "nombre": "HOYA NULUX IDENTITY V+ - 1.60 CLEAR",
        "linea": "nulux",
        "diseno": "Nulux Identity V+",
        "tipo": "Cristal Monofocal",
        "material": "1.60 CLEAR",
        "indice": "1.60",
        "codigos": [
            "10470"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 143800
    },
    {
        "nombre": "HOYA NULUX IDENTITY V+ - 1.60 BLUE FILTER UV-420",
        "linea": "nulux",
        "diseno": "Nulux Identity V+",
        "tipo": "Cristal Monofocal",
        "material": "1.60 BLUE FILTER UV-420",
        "indice": "1.60",
        "codigos": [
            "10472"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 151200
    },
    {
        "nombre": "HOYA NULUX IDENTITY V+ - 1.60 SENSITY 2",
        "linea": "nulux",
        "diseno": "Nulux Identity V+",
        "tipo": "Cristal Monofocal",
        "material": "1.60 SENSITY 2",
        "indice": "1.60",
        "codigos": [
            "10474/76/78"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 319400
    },
    {
        "nombre": "HOYA NULUX IDENTITY V+ - 1.67 CLEAR",
        "linea": "nulux",
        "diseno": "Nulux Identity V+",
        "tipo": "Cristal Monofocal",
        "material": "1.67 CLEAR",
        "indice": "1.67",
        "codigos": [
            "10479"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 218200
    },
    {
        "nombre": "HOYA NULUX IDENTITY V+ - 1.67 CLEAR BLUE FILTER",
        "linea": "nulux",
        "diseno": "Nulux Identity V+",
        "tipo": "Cristal Monofocal",
        "material": "1.67 CLEAR BLUE FILTER",
        "indice": "1.67",
        "codigos": [
            "10480"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 232800
    },
    {
        "nombre": "HOYA NULUX IDENTITY V+ - 1.67 SENSITY 2",
        "linea": "nulux",
        "diseno": "Nulux Identity V+",
        "tipo": "Cristal Monofocal",
        "material": "1.67 SENSITY 2",
        "indice": "1.67",
        "codigos": [
            "10482"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 418400
    },
    {
        "nombre": "HOYA NULUX IDENTITY V+ - 1.74 CLEAR",
        "linea": "nulux",
        "diseno": "Nulux Identity V+",
        "tipo": "Cristal Monofocal",
        "material": "1.74 CLEAR",
        "indice": "1.74",
        "codigos": [
            "10484"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 381000
    },
    {
        "nombre": "HOYA SYNC III - 1.50 CLEAR BLUE FILTER",
        "linea": "sync-iii",
        "diseno": "Sync III",
        "tipo": "Cristal Monofocal",
        "material": "1.50 CLEAR BLUE FILTER",
        "indice": "1.50",
        "codigos": [
            "10302",
            "10352",
            "10402"
        ],
        "variantes": [
            "5",
            "9",
            "13 (refuerzo 0.57",
            "0.95",
            "1.32)"
        ],
        "sinAntirreflejo": false,
        "precioLista": 149800
    },
    {
        "nombre": "HOYA SYNC III - 1.50 SENSITY 2",
        "linea": "sync-iii",
        "diseno": "Sync III",
        "tipo": "Cristal Monofocal",
        "material": "1.50 SENSITY 2",
        "indice": "1.50",
        "codigos": [
            "10304",
            "10354",
            "10404"
        ],
        "variantes": [
            "5",
            "9",
            "13 (refuerzo 0.57",
            "0.95",
            "1.32)"
        ],
        "sinAntirreflejo": false,
        "precioLista": 257600
    },
    {
        "nombre": "HOYA SYNC III - 1.59 CLEAR BLUE FILTER",
        "linea": "sync-iii",
        "diseno": "Sync III",
        "tipo": "Cristal Monofocal",
        "material": "1.59 CLEAR BLUE FILTER",
        "indice": "1.59",
        "codigos": [
            "10308",
            "10358",
            "10408"
        ],
        "variantes": [
            "5",
            "9",
            "13 (refuerzo 0.57",
            "0.95",
            "1.32)"
        ],
        "sinAntirreflejo": false,
        "precioLista": 154600
    },
    {
        "nombre": "HOYA SYNC III - 1.59 SENSITY 2",
        "linea": "sync-iii",
        "diseno": "Sync III",
        "tipo": "Cristal Monofocal",
        "material": "1.59 SENSITY 2",
        "indice": "1.59",
        "codigos": [
            "10310",
            "10360",
            "10410"
        ],
        "variantes": [
            "5",
            "9",
            "13 (refuerzo 0.57",
            "0.95",
            "1.32)"
        ],
        "sinAntirreflejo": false,
        "precioLista": 310200
    },
    {
        "nombre": "HOYA SYNC III - 1.60 CLEAR",
        "linea": "sync-iii",
        "diseno": "Sync III",
        "tipo": "Cristal Monofocal",
        "material": "1.60 CLEAR",
        "indice": "1.60",
        "codigos": [
            "10318",
            "10368",
            "10418"
        ],
        "variantes": [
            "5",
            "9",
            "13 (refuerzo 0.57",
            "0.95",
            "1.32)"
        ],
        "sinAntirreflejo": false,
        "precioLista": 150000
    },
    {
        "nombre": "HOYA SYNC III - 1.60 BLUE FILTER UV-420",
        "linea": "sync-iii",
        "diseno": "Sync III",
        "tipo": "Cristal Monofocal",
        "material": "1.60 BLUE FILTER UV-420",
        "indice": "1.60",
        "codigos": [
            "10320",
            "10370",
            "10420"
        ],
        "variantes": [
            "5",
            "9",
            "13 (refuerzo 0.57",
            "0.95",
            "1.32)"
        ],
        "sinAntirreflejo": false,
        "precioLista": 162600
    },
    {
        "nombre": "HOYA SYNC III - 1.60 SENSITY 2",
        "linea": "sync-iii",
        "diseno": "Sync III",
        "tipo": "Cristal Monofocal",
        "material": "1.60 SENSITY 2",
        "indice": "1.60",
        "codigos": [
            "10322/24/26",
            "10372/74/76",
            "10422/24/26"
        ],
        "variantes": [
            "5",
            "9",
            "13 (refuerzo 0.57",
            "0.95",
            "1.32)"
        ],
        "sinAntirreflejo": false,
        "precioLista": 335400
    },
    {
        "nombre": "HOYA SYNC III - 1.67 CLEAR",
        "linea": "sync-iii",
        "diseno": "Sync III",
        "tipo": "Cristal Monofocal",
        "material": "1.67 CLEAR",
        "indice": "1.67",
        "codigos": [
            "10327",
            "10377",
            "10427"
        ],
        "variantes": [
            "5",
            "9",
            "13 (refuerzo 0.57",
            "0.95",
            "1.32)"
        ],
        "sinAntirreflejo": false,
        "precioLista": 228200
    },
    {
        "nombre": "HOYA SYNC III - 1.67 CLEAR BLUE FILTER",
        "linea": "sync-iii",
        "diseno": "Sync III",
        "tipo": "Cristal Monofocal",
        "material": "1.67 CLEAR BLUE FILTER",
        "indice": "1.67",
        "codigos": [
            "10328",
            "10378",
            "10428"
        ],
        "variantes": [
            "5",
            "9",
            "13 (refuerzo 0.57",
            "0.95",
            "1.32)"
        ],
        "sinAntirreflejo": false,
        "precioLista": 243000
    },
    {
        "nombre": "HOYA SYNC III - 1.67 SENSITY 2",
        "linea": "sync-iii",
        "diseno": "Sync III",
        "tipo": "Cristal Monofocal",
        "material": "1.67 SENSITY 2",
        "indice": "1.67",
        "codigos": [
            "10330",
            "10380",
            "10430"
        ],
        "variantes": [
            "5",
            "9",
            "13 (refuerzo 0.57",
            "0.95",
            "1.32)"
        ],
        "sinAntirreflejo": false,
        "precioLista": 438000
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.50 CLEAR BLUE FILTER — SIN ANTIRREFLEJO",
        "linea": "vision-simple-sin-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.50 CLEAR BLUE FILTER",
        "indice": "1.50",
        "codigos": [
            "10552"
        ],
        "variantes": [],
        "sinAntirreflejo": true,
        "precioLista": 42400
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.50 SENSITY 2 — SIN ANTIRREFLEJO",
        "linea": "vision-simple-sin-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.50 SENSITY 2",
        "indice": "1.50",
        "codigos": [
            "10554"
        ],
        "variantes": [],
        "sinAntirreflejo": true,
        "precioLista": 180000
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.50 POLARIZED — SIN ANTIRREFLEJO",
        "linea": "vision-simple-sin-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.50 POLARIZED",
        "indice": "1.50",
        "codigos": [
            "10556/58"
        ],
        "variantes": [],
        "sinAntirreflejo": true,
        "precioLista": 100600
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.59 CLEAR BLUE FILTER — SIN ANTIRREFLEJO",
        "linea": "vision-simple-sin-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.59 CLEAR BLUE FILTER",
        "indice": "1.59",
        "codigos": [
            "10564"
        ],
        "variantes": [],
        "sinAntirreflejo": true,
        "precioLista": 49300
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.59 SENSITY 2 — SIN ANTIRREFLEJO",
        "linea": "vision-simple-sin-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.59 SENSITY 2",
        "indice": "1.59",
        "codigos": [
            "10566"
        ],
        "variantes": [],
        "sinAntirreflejo": true,
        "precioLista": 212800
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.60 CLEAR — SIN ANTIRREFLEJO",
        "linea": "vision-simple-sin-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.60 CLEAR",
        "indice": "1.60",
        "codigos": [
            "10574"
        ],
        "variantes": [],
        "sinAntirreflejo": true,
        "precioLista": 63800
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.60 BLUE FILTER UV-420 — SIN ANTIRREFLEJO",
        "linea": "vision-simple-sin-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.60 BLUE FILTER UV-420",
        "indice": "1.60",
        "codigos": [
            "10576"
        ],
        "variantes": [],
        "sinAntirreflejo": true,
        "precioLista": 76600
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.67 CLEAR — SIN ANTIRREFLEJO",
        "linea": "vision-simple-sin-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.67 CLEAR",
        "indice": "1.67",
        "codigos": [
            "10584"
        ],
        "variantes": [],
        "sinAntirreflejo": true,
        "precioLista": 129100
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.67 CLEAR BLUE FILTER — SIN ANTIRREFLEJO",
        "linea": "vision-simple-sin-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.67 CLEAR BLUE FILTER",
        "indice": "1.67",
        "codigos": [
            "10586"
        ],
        "variantes": [],
        "sinAntirreflejo": true,
        "precioLista": 163800
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.50 CLEAR BLUE FILTER — CON ANTIRREFLEJO",
        "linea": "vision-simple-con-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.50 CLEAR BLUE FILTER",
        "indice": "1.50",
        "codigos": [
            "10552"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 83900
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.50 SENSITY 2 — CON ANTIRREFLEJO",
        "linea": "vision-simple-con-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.50 SENSITY 2",
        "indice": "1.50",
        "codigos": [
            "10554"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 221500
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.50 POLARIZED — CON ANTIRREFLEJO",
        "linea": "vision-simple-con-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.50 POLARIZED",
        "indice": "1.50",
        "codigos": [
            "10556/58"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 142100
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.59 CLEAR BLUE FILTER — CON ANTIRREFLEJO",
        "linea": "vision-simple-con-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.59 CLEAR BLUE FILTER",
        "indice": "1.59",
        "codigos": [
            "10564"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 90800
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.59 SENSITY 2 — CON ANTIRREFLEJO",
        "linea": "vision-simple-con-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.59 SENSITY 2",
        "indice": "1.59",
        "codigos": [
            "10566"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 254300
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.60 CLEAR — CON ANTIRREFLEJO",
        "linea": "vision-simple-con-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.60 CLEAR",
        "indice": "1.60",
        "codigos": [
            "10574"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 105300
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.60 BLUE FILTER UV-420 — CON ANTIRREFLEJO",
        "linea": "vision-simple-con-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.60 BLUE FILTER UV-420",
        "indice": "1.60",
        "codigos": [
            "10576"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 118100
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.67 CLEAR — CON ANTIRREFLEJO",
        "linea": "vision-simple-con-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.67 CLEAR",
        "indice": "1.67",
        "codigos": [
            "10584"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 170600
    },
    {
        "nombre": "HOYA VISIÓN SIMPLE DIGITAL - 1.67 CLEAR BLUE FILTER — CON ANTIRREFLEJO",
        "linea": "vision-simple-con-ar",
        "diseno": "Visión Simple Digital",
        "tipo": "Cristal Monofocal",
        "material": "1.67 CLEAR BLUE FILTER",
        "indice": "1.67",
        "codigos": [
            "10586"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 205300
    },
    {
        "nombre": "PENTAX ALLFOCUS PRO - 1.50 ORGÁNICO CLEAR",
        "linea": "allfocus-pro",
        "diseno": "Pentax Allfocus Pro",
        "tipo": "Cristal Multifocal",
        "material": "1.50 ORGÁNICO CLEAR",
        "indice": "1.50",
        "codigos": [
            "20000"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 240000
    },
    {
        "nombre": "PENTAX ALLFOCUS PRO - 1.50 SENSITY FOTO GREY",
        "linea": "allfocus-pro",
        "diseno": "Pentax Allfocus Pro",
        "tipo": "Cristal Multifocal",
        "material": "1.50 SENSITY FOTO GREY",
        "indice": "1.50",
        "codigos": [
            "20005"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 325200
    },
    {
        "nombre": "PENTAX ALLFOCUS PRO - 1.59 POLICARBONATO CLEAR",
        "linea": "allfocus-pro",
        "diseno": "Pentax Allfocus Pro",
        "tipo": "Cristal Multifocal",
        "material": "1.59 POLICARBONATO CLEAR",
        "indice": "1.59",
        "codigos": [
            "20010"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 260000
    },
    {
        "nombre": "PENTAX ALLFOCUS PRO - 1.60 BLUE FILTER UV-420",
        "linea": "allfocus-pro",
        "diseno": "Pentax Allfocus Pro",
        "tipo": "Cristal Multifocal",
        "material": "1.60 BLUE FILTER UV-420",
        "indice": "1.60",
        "codigos": [
            "20015"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 297000
    },
    {
        "nombre": "PENTAX ALLFOCUS FLEX - 1.50 ORGÁNICO CLEAR",
        "linea": "allfocus-flex",
        "diseno": "Pentax Allfocus Flex",
        "tipo": "Cristal Multifocal",
        "material": "1.50 ORGÁNICO CLEAR",
        "indice": "1.50",
        "codigos": [
            "20040"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 214200
    },
    {
        "nombre": "PENTAX ALLFOCUS FLEX - 1.50 SENSITY FOTO GREY",
        "linea": "allfocus-flex",
        "diseno": "Pentax Allfocus Flex",
        "tipo": "Cristal Multifocal",
        "material": "1.50 SENSITY FOTO GREY",
        "indice": "1.50",
        "codigos": [
            "20045"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 299600
    },
    {
        "nombre": "PENTAX ALLFOCUS FLEX - 1.59 POLICARBONATO CLEAR",
        "linea": "allfocus-flex",
        "diseno": "Pentax Allfocus Flex",
        "tipo": "Cristal Multifocal",
        "material": "1.59 POLICARBONATO CLEAR",
        "indice": "1.59",
        "codigos": [
            "20050"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 232400
    },
    {
        "nombre": "PENTAX ALLFOCUS FLEX - 1.60 BLUE FILTER UV-420",
        "linea": "allfocus-flex",
        "diseno": "Pentax Allfocus Flex",
        "tipo": "Cristal Multifocal",
        "material": "1.60 BLUE FILTER UV-420",
        "indice": "1.60",
        "codigos": [
            "20055"
        ],
        "variantes": [],
        "sinAntirreflejo": false,
        "precioLista": 267600
    },
    {
        "nombre": "PENTAX OFFICE - 1.50 ORGÁNICO CLEAR",
        "linea": "pentax-office",
        "diseno": "Pentax Office",
        "tipo": "Cristal Ocupacional",
        "material": "1.50 ORGÁNICO CLEAR",
        "indice": "1.50",
        "codigos": [
            "20060",
            "20080"
        ],
        "variantes": [
            "DP40",
            "SP60"
        ],
        "sinAntirreflejo": false,
        "precioLista": 120400
    },
    {
        "nombre": "PENTAX OFFICE - 1.59 POLICARBONATO CLEAR",
        "linea": "pentax-office",
        "diseno": "Pentax Office",
        "tipo": "Cristal Ocupacional",
        "material": "1.59 POLICARBONATO CLEAR",
        "indice": "1.59",
        "codigos": [
            "20065",
            "20085"
        ],
        "variantes": [
            "DP40",
            "SP60"
        ],
        "sinAntirreflejo": false,
        "precioLista": 133800
    },
    {
        "nombre": "PENTAX OFFICE - 1.60 BLUE FILTER UV-420",
        "linea": "pentax-office",
        "diseno": "Pentax Office",
        "tipo": "Cristal Ocupacional",
        "material": "1.60 BLUE FILTER UV-420",
        "indice": "1.60",
        "codigos": [
            "20070",
            "20090"
        ],
        "variantes": [
            "DP40",
            "SP60"
        ],
        "sinAntirreflejo": false,
        "precioLista": 162000
    }
];

/**
 * La venta guarda el nombre del cristal SIN la marca ("Array 2 - 1.60 Blue
 * Filter UV-420": productNameSnapshot sale del modelo), y el catálogo lo tiene
 * con ella ("HOYA ARRAY 2 - …"). Se comparan los dos sin la marca del frente;
 * "MI PRIMER HOYA …" no empieza con la marca, así que no se confunde con Array 2.
 */
const sinMarca = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ').replace(/^(HOYA|PENTAX) /, '');

export function cristalVitolenPorNombre(nombre: string | null | undefined): CristalVitolen | null {
    const n = sinMarca(String(nombre || ''));
    if (!n) return null;
    return CATALOGO_VITOLEN.find(c => sinMarca(c.nombre) === n) ?? null;
}
