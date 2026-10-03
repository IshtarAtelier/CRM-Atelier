// RELEVADO del formulario de carga de gestion.vitolen.com el 3/10/2026 (clase
// Progresivo): los diseños (logos, por su data-id) y los materiales que cada uno
// ofrece, con el id y el texto exacto del portal. Fuente: docs/vitolen-portal.md.
// El robot elige el material POR TEXTO (materiales.ts); el id solo se usa para
// marcarlo en el select. Si el portal cambia, se vuelve a relevar y se regenera.

export interface OpcionMaterial { id: string; texto: string }
export interface DisenoPortal { dataId: string; nombre: string; materiales: OpcionMaterial[] }

export const RELEVADO_EL = '2026-10-03';

export const DISENOS_PORTAL: DisenoPortal[] = [
  {
    "dataId": "17",
    "nombre": "Amplitude Freestyle IA",
    "materiales": [
      {
        "id": "1955",
        "texto": "Amplitude FREESTYLE IA 1.50 Orgánico Blanco"
      },
      {
        "id": "1956",
        "texto": "Amplitude FREESTYLE IA 1.50 Orgánico Smart Control"
      },
      {
        "id": "1957",
        "texto": "Amplitude FREESTYLE IA 1.50 Orgánico SUNMATIC Gris"
      },
      {
        "id": "1958",
        "texto": "Amplitude FREESTYLE IA 1.50 Orgánico SUNMATIC Café"
      },
      {
        "id": "2249",
        "texto": "Amplitude FREESTYLE IA 1.50 Orgánico SUNMATIC Azul"
      },
      {
        "id": "2250",
        "texto": "Amplitude FREESTYLE IA 1.50 Orgánico SUNMATIC Rosado"
      },
      {
        "id": "1962",
        "texto": "Amplitude FREESTYLE IA 1.50 Orgánico Polarizado Gris"
      },
      {
        "id": "1963",
        "texto": "Amplitude FREESTYLE IA 1.50 Orgánico Polarizado Café"
      },
      {
        "id": "1964",
        "texto": "Amplitude FREESTYLE IA 1.50 Orgánico Polarizado G15"
      },
      {
        "id": "1965",
        "texto": "Amplitude FREESTYLE IA 1.50 Orgánico Polarizado Gris Espejado Plata"
      },
      {
        "id": "1966",
        "texto": "Amplitude FREESTYLE IA 1.50 Orgánico Polarizado Gris Espejado Azul"
      },
      {
        "id": "1967",
        "texto": "Amplitude FREESTYLE IA 1.50 Orgánico Polarizado Marron Espejado Dorado"
      },
      {
        "id": "1968",
        "texto": "Amplitude FREESTYLE IA 1.50 Orgánico Drivewear Polarizado Transitions"
      },
      {
        "id": "1971",
        "texto": "Amplitude FREESTYLE IA 1.59 Policarbonato Blanco"
      },
      {
        "id": "2080",
        "texto": "Amplitude FREESTYLE IA 1.59 Policarbonato Smart Control"
      },
      {
        "id": "1973",
        "texto": "Amplitude FREESTYLE IA 1.60 MR-8 Blanco"
      },
      {
        "id": "1974",
        "texto": "Amplitude FREESTYLE IA 1.60 MR-8 Control Blue"
      },
      {
        "id": "2181",
        "texto": "Amplitude FREESTYLE IA 1.60 MR-8 SUNMATIC Gris"
      },
      {
        "id": "1975",
        "texto": "Amplitude FREESTYLE IA 1.67 Orgathin Blanco"
      },
      {
        "id": "1976",
        "texto": "Amplitude FREESTYLE IA 1.67 Orgathin SUNMATIC Gris"
      },
      {
        "id": "1977",
        "texto": "Amplitude FREESTYLE IA 1.74 Nexus Blanco"
      }
    ]
  },
  {
    "dataId": "18",
    "nombre": "Amplitude Plus",
    "materiales": [
      {
        "id": "1978",
        "texto": "Amplitude PLUS 1.50 Orgánico Blanco"
      },
      {
        "id": "1979",
        "texto": "Amplitude PLUS 1.50 Orgánico Smart Control"
      },
      {
        "id": "1980",
        "texto": "Amplitude PLUS 1.50 Orgánico SUNMATIC Gris"
      },
      {
        "id": "1981",
        "texto": "Amplitude PLUS 1.50 Orgánico SUNMATIC Café"
      },
      {
        "id": "2251",
        "texto": "Amplitude PLUS 1.50 Orgánico SUNMATIC Azul"
      },
      {
        "id": "2252",
        "texto": "Amplitude PLUS 1.50 Orgánico SUNMATIC Rosado"
      },
      {
        "id": "1985",
        "texto": "Amplitude PLUS 1.50 Orgánico Polarizado Gris"
      },
      {
        "id": "1986",
        "texto": "Amplitude PLUS 1.50 Orgánico Polarizado Café"
      },
      {
        "id": "1987",
        "texto": "Amplitude PLUS 1.50 Orgánico Polarizado G15"
      },
      {
        "id": "1988",
        "texto": "Amplitude PLUS 1.50 Orgánico Polarizado Gris Espejado Plata"
      },
      {
        "id": "1989",
        "texto": "Amplitude PLUS 1.50 Orgánico Polarizado Gris Espejado Azul"
      },
      {
        "id": "1990",
        "texto": "Amplitude PLUS 1.50 Orgánico Polarizado Marron Espejado Dorado"
      },
      {
        "id": "1991",
        "texto": "Amplitude PLUS 1.50 Orgánico Drivewear Polarizado Transitions"
      },
      {
        "id": "1994",
        "texto": "Amplitude PLUS 1.59 Policarbonato Blanco"
      },
      {
        "id": "2081",
        "texto": "Amplitude PLUS 1.59 Policarbonato Smart Control"
      },
      {
        "id": "2212",
        "texto": "Amplitude PLUS 1.59 Policarbonato Polarizado Café"
      },
      {
        "id": "2129",
        "texto": "Amplitude PLUS 1.59 Policarbonato Polarizado Gris"
      },
      {
        "id": "1996",
        "texto": "Amplitude PLUS 1.60 MR-8 Blanco"
      },
      {
        "id": "1997",
        "texto": "Amplitude PLUS 1.60 MR-8 Control Blue"
      },
      {
        "id": "2190",
        "texto": "Amplitude PLUS 1.60 MR-8 SUNMATIC Gris"
      },
      {
        "id": "1998",
        "texto": "Amplitude PLUS 1.67 Orgathin Blanco"
      },
      {
        "id": "1999",
        "texto": "Amplitude PLUS 1.67 Orgathin SUNMATIC Gris"
      },
      {
        "id": "2000",
        "texto": "Amplitude PLUS 1.74 Nexus Blanco"
      }
    ]
  },
  {
    "dataId": "19",
    "nombre": "Amplitude View",
    "materiales": [
      {
        "id": "2001",
        "texto": "Amplitude VIEW 1.50 Orgánico Blanco"
      },
      {
        "id": "2002",
        "texto": "Amplitude VIEW 1.50 Orgánico Smart Control"
      },
      {
        "id": "2003",
        "texto": "Amplitude VIEW 1.50 Orgánico SUNMATIC Gris"
      },
      {
        "id": "2326",
        "texto": "Amplitude VIEW 1.50 Orgánico SUNMATIC Azul"
      },
      {
        "id": "2004",
        "texto": "Amplitude VIEW 1.50 Orgánico SUNMATIC Café"
      },
      {
        "id": "2327",
        "texto": "Amplitude VIEW 1.50 Orgánico SUNMATIC Rosado"
      },
      {
        "id": "2008",
        "texto": "Amplitude VIEW 1.50 Orgánico Polarizado Gris"
      },
      {
        "id": "2009",
        "texto": "Amplitude VIEW 1.50 Orgánico Polarizado Café"
      },
      {
        "id": "2010",
        "texto": "Amplitude VIEW 1.50 Orgánico Polarizado G15"
      },
      {
        "id": "2011",
        "texto": "Amplitude VIEW 1.50 Orgánico Polarizado Gris Espejado Plata"
      },
      {
        "id": "2012",
        "texto": "Amplitude VIEW 1.50 Orgánico Polarizado Gris Espejado Azul"
      },
      {
        "id": "2013",
        "texto": "Amplitude VIEW 1.50 Orgánico Polarizado Marron Espejado Dorado"
      },
      {
        "id": "2014",
        "texto": "Amplitude VIEW 1.50 Orgánico Drivewear Polarizado Transitions"
      },
      {
        "id": "2017",
        "texto": "Amplitude VIEW 1.59 Policarbonato Blanco"
      },
      {
        "id": "2082",
        "texto": "Amplitude VIEW 1.59 Policarbonato Smart Control"
      },
      {
        "id": "2135",
        "texto": "Amplitude VIEW 1.59 Policarbonato Polarizado Gris"
      },
      {
        "id": "2136",
        "texto": "Amplitude VIEW 1.59 Policarbonato Polarizado Café"
      },
      {
        "id": "2019",
        "texto": "Amplitude VIEW 1.60 MR-8 Blanco"
      },
      {
        "id": "2020",
        "texto": "Amplitude VIEW 1.60 MR-8 Control Blue"
      },
      {
        "id": "2180",
        "texto": "Amplitude VIEW 1.60 MR-8 SUNMATIC Gris"
      },
      {
        "id": "2021",
        "texto": "Amplitude VIEW 1.67 Orgathin Blanco"
      },
      {
        "id": "2022",
        "texto": "Amplitude VIEW 1.67 Orgathin SUNMATIC Gris"
      }
    ]
  },
  {
    "dataId": "21",
    "nombre": "Amplitude Classic",
    "materiales": [
      {
        "id": "2035",
        "texto": "Amplitude CLASSIC 1.50 Orgánico Blanco"
      },
      {
        "id": "2036",
        "texto": "Amplitude CLASSIC 1.50 Orgánico Smart Control"
      },
      {
        "id": "2038",
        "texto": "Amplitude CLASSIC 1.50 Orgánico SUNMATIC Gris"
      },
      {
        "id": "2039",
        "texto": "Amplitude CLASSIC 1.50 Orgánico SUNMATIC Café"
      },
      {
        "id": "2328",
        "texto": "Amplitude CLASSIC 1.50 Orgánico SUNMATIC Azul"
      },
      {
        "id": "2329",
        "texto": "Amplitude CLASSIC 1.50 Orgánico SUNMATIC Rosado"
      },
      {
        "id": "2043",
        "texto": "Amplitude CLASSIC 1.50 Orgánico Polarizado Gris"
      },
      {
        "id": "2044",
        "texto": "Amplitude CLASSIC 1.50 Orgánico Polarizado Café"
      },
      {
        "id": "2045",
        "texto": "Amplitude CLASSIC 1.50 Orgánico Polarizado G15"
      },
      {
        "id": "2046",
        "texto": "Amplitude CLASSIC 1.50 Orgánico Polarizado Gris Espejado Plata"
      },
      {
        "id": "2047",
        "texto": "Amplitude CLASSIC 1.50 Orgánico Polarizado Gris Espejado Azul"
      },
      {
        "id": "2048",
        "texto": "Amplitude CLASSIC 1.50 Orgánico Polarizado Marron Espejado Dorado"
      },
      {
        "id": "2049",
        "texto": "Amplitude CLASSIC 1.59 Policarbonato Blanco"
      },
      {
        "id": "2083",
        "texto": "Amplitude CLASSIC 1.59 Policarbonato Smart Control"
      },
      {
        "id": "2222",
        "texto": "Amplitude CLASSIC 1.59 Policarbonato Polarizado Gris"
      },
      {
        "id": "2224",
        "texto": "Amplitude CLASSIC 1.59 Policarbonato Polarizado Café"
      },
      {
        "id": "2051",
        "texto": "Amplitude CLASSIC 1.60 MR-8 Blanco"
      },
      {
        "id": "2052",
        "texto": "Amplitude CLASSIC 1.60 MR-8 Control Blue"
      },
      {
        "id": "2183",
        "texto": "Amplitude CLASSIC 1.60 MR-8 SUNMATIC Gris"
      }
    ]
  },
  {
    "dataId": "22",
    "nombre": "Amplitude First",
    "materiales": [
      {
        "id": "2023",
        "texto": "Amplitude FIRST PLUS 1.50 Orgánico Blanco Add hasta 1.75"
      },
      {
        "id": "2024",
        "texto": "Amplitude FIRST VIEW 1.50 Orgánico Blanco Add hasta 1.75"
      },
      {
        "id": "2025",
        "texto": "Amplitude FIRST PLUS 1.50 Orgánico SUNMATIC Gris Add hasta 1.75"
      },
      {
        "id": "2103",
        "texto": "Amplitude FIRST PLUS 1.50 Orgánico SUNMATIC Café Add hasta 1.75"
      },
      {
        "id": "2026",
        "texto": "Amplitude FIRST VIEW 1.50 Orgánico SUNMATIC Gris Add hasta 1.75"
      },
      {
        "id": "2102",
        "texto": "Amplitude FIRST VIEW 1.50 Orgánico SUNMATIC Café Add hasta 1.75"
      },
      {
        "id": "2027",
        "texto": "Amplitude FIRST PLUS 1.60 MR-8 Blanco Add hasta 1.75"
      },
      {
        "id": "2028",
        "texto": "Amplitude FIRST VIEW 1.60 MR-8 Blanco Add hasta 1.75"
      },
      {
        "id": "2029",
        "texto": "Amplitude FIRST PLUS 1.60 MR-8 Control Blue Add hasta 1.75"
      },
      {
        "id": "2030",
        "texto": "Amplitude FIRST VIEW 1.60 MR-8 Control Blue Add hasta 1.75"
      }
    ]
  },
  {
    "dataId": "56",
    "nombre": "Hoya Lifestyle 4",
    "materiales": [
      {
        "id": "2256",
        "texto": "IDLS4 URBAN 1.50 Hilux Clear"
      },
      {
        "id": "2259",
        "texto": "IDLS4 URBAN 1.50 Hilux Sensity 2 Grey"
      },
      {
        "id": "2260",
        "texto": "IDLS4 INDOOR 1.50 Hilux Clear"
      },
      {
        "id": "2261",
        "texto": "IDLS4 INDOOR 1.50 Hilux Sensity 2 Grey"
      },
      {
        "id": "2264",
        "texto": "IDLS4 OUTDOOR 1.50 Hilux Clear"
      },
      {
        "id": "2265",
        "texto": "IDLS4 OUTDOOR 1.50 Hilux Sensity 2 Grey"
      }
    ]
  },
  {
    "dataId": "23",
    "nombre": "Hoya Array 2",
    "materiales": [
      {
        "id": "1635",
        "texto": "Array 2 1.50 Hilux Clear Blue Filter"
      },
      {
        "id": "1637",
        "texto": "Array 2 1.50 Hilux Sensity 2 Grey"
      },
      {
        "id": "1639",
        "texto": "Array 2 1.59 Hilux Clear Blue Filter"
      },
      {
        "id": "1640",
        "texto": "Array 2 1.59 Hilux Sensity 2 Grey"
      },
      {
        "id": "1641",
        "texto": "Array 2 1.59 Hilux Polarized Grey"
      },
      {
        "id": "1642",
        "texto": "Array 2 1.59 Hilux Polarized Brown"
      },
      {
        "id": "1643",
        "texto": "Array 2 1.59 Hilux Polarized Green"
      },
      {
        "id": "1644",
        "texto": "Array 2 1.60 Hilux MR-8 Clear"
      },
      {
        "id": "1645",
        "texto": "Array 2 1.60 Hilux MR-8 Filter 420"
      },
      {
        "id": "1646",
        "texto": "Array 2 1.60 Hilux MR-8 Sensity 2 Grey"
      },
      {
        "id": "1647",
        "texto": "Array 2 1.60 Hilux MR-8 Sensity 2 Brown"
      },
      {
        "id": "1648",
        "texto": "Array 2 1.60 Hilux MR-8 Sensity 2 Green"
      },
      {
        "id": "1649",
        "texto": "Array 2 1.67 Hilux Clear"
      },
      {
        "id": "1650",
        "texto": "Array 2 1.67 Hilux Clear Blue Filter"
      },
      {
        "id": "1651",
        "texto": "Array 2 1.67 Hilux Sensity 2 Grey"
      },
      {
        "id": "1652",
        "texto": "Array 2 1.74 Hilux Clear"
      },
      {
        "id": "1653",
        "texto": "Array Wrap 1.50 Hilux Clear Blue Filter"
      },
      {
        "id": "1656",
        "texto": "Array Wrap 1.50 Sensity Grey"
      },
      {
        "id": "1657",
        "texto": "Array Wrap 1.59 Hilux Clear Blue Filter"
      },
      {
        "id": "1658",
        "texto": "Array Wrap 1.59 Hilux Sensity Grey"
      },
      {
        "id": "1659",
        "texto": "Array Wrap 1.59 Hilux Polarizado Grey"
      },
      {
        "id": "1660",
        "texto": "Array Wrap 1.59 Hilux Polarizado Brown"
      },
      {
        "id": "1661",
        "texto": "Array Wrap 1.59 Hilux Polarizado Green"
      },
      {
        "id": "1662",
        "texto": "Array Wrap 1.60 Hilux MR-8 Clear"
      },
      {
        "id": "1663",
        "texto": "Array Wrap 1.60 Hilux MR-8 Filter 420"
      },
      {
        "id": "1664",
        "texto": "Array Wrap 1.60 Hilux MR-8 Sensity 2 Grey"
      },
      {
        "id": "1665",
        "texto": "Array Wrap 1.60 Hilux MR-8 Sensity 2 Brown"
      },
      {
        "id": "1666",
        "texto": "Array Wrap 1.60 Hilux MR-8 Sensity 2 Green"
      },
      {
        "id": "1667",
        "texto": "Array Wrap 1.67 Hilux Clear"
      },
      {
        "id": "1668",
        "texto": "Array Wrap 1.67 Hilux Clear Blue Filter"
      },
      {
        "id": "1669",
        "texto": "Array Wrap 1.67 Hilux Sensity 2 Grey"
      },
      {
        "id": "1670",
        "texto": "Array Wrap 1.74 Hilux Clear"
      }
    ]
  },
  {
    "dataId": "25",
    "nombre": "Hoya Summit Premium",
    "materiales": [
      {
        "id": "1606",
        "texto": "Summit Premiun 1.50 Hilux Clear Blue Filter"
      },
      {
        "id": "1609",
        "texto": "Summit Premiun 1.50 Hilux Sensity 2 Grey"
      },
      {
        "id": "1607",
        "texto": "Summit Premiun 1.50 Hilux Polarized Grey"
      },
      {
        "id": "1608",
        "texto": "Summit Premiun 1.50 Hilux Polarized Brown"
      },
      {
        "id": "1610",
        "texto": "Summit Premiun 1.59 Hilux Clear Blue Filter"
      },
      {
        "id": "1611",
        "texto": "Summit Premiun 1.59 Hilux Sensity 2 Grey"
      },
      {
        "id": "1612",
        "texto": "Summit Premiun 1.59 Hilux Polarized Grey"
      },
      {
        "id": "1613",
        "texto": "Summit Premiun 1.59 Hilux Polarized Brown"
      },
      {
        "id": "1614",
        "texto": "Summit Premiun 1.59 Hilux Polarized Green"
      },
      {
        "id": "1615",
        "texto": "Summit Premiun 1.60 Hilux MR-8 Clear"
      },
      {
        "id": "1616",
        "texto": "Summit Premiun 1.60 Hilux MR-8 Filter 420"
      },
      {
        "id": "1617",
        "texto": "Summit Premiun 1.60 Hilux MR-8 Sensity 2 Grey"
      },
      {
        "id": "1618",
        "texto": "Summit Premiun 1.60 Hilux MR-8 Sensity 2 Brown"
      },
      {
        "id": "1619",
        "texto": "Summit Premiun 1.60 Hilux MR-8 Sensity 2 Green"
      },
      {
        "id": "1620",
        "texto": "Summit Premiun 1.67 Hilux Clear"
      },
      {
        "id": "1584",
        "texto": "Summit Premiun 1.67 Hilux Clear Blue Filter"
      },
      {
        "id": "1621",
        "texto": "Summit Premiun 1.67 Hilux Sensity 2 Grey"
      },
      {
        "id": "1622",
        "texto": "Summit Premiun 1.74 Hilux Clear"
      }
    ]
  },
  {
    "dataId": "26",
    "nombre": "Hoya Argos BKS",
    "materiales": [
      {
        "id": "1623",
        "texto": "Argos BKS 1.50 Hilux Clear"
      },
      {
        "id": "1624",
        "texto": "Argos BKS 1.50 Hilux Clear Blue Filter"
      },
      {
        "id": "1627",
        "texto": "Argos BKS 1.50 Hilux Sensity 2 Grey"
      },
      {
        "id": "1625",
        "texto": "Argos BKS 1.50 Hilux Polarized Grey"
      },
      {
        "id": "1626",
        "texto": "Argos BKS 1.50 Hilux Polarized Brown"
      },
      {
        "id": "1600",
        "texto": "Argos BKS 1.59 Hilux Clear"
      },
      {
        "id": "1799",
        "texto": "Argos BKS 1.59 Hilux Clear Blue Filter"
      },
      {
        "id": "1629",
        "texto": "Argos BKS 1.59 Hilux Sensity 2 Grey"
      },
      {
        "id": "1630",
        "texto": "Argos BKS 1.60 Hilux MR-8 Clear"
      },
      {
        "id": "1631",
        "texto": "Argos BKS 1.60 Hilux MR-8 Filter 420"
      },
      {
        "id": "1632",
        "texto": "Argos BKS 1.60 Hilux MR-8 Sensity 2 Grey"
      },
      {
        "id": "1633",
        "texto": "Argos BKS 1.60 Hilux MR-8 Sensity 2 Brown"
      },
      {
        "id": "1634",
        "texto": "Argos BKS 1.60 Hilux MR-8 Sensity 2 Green"
      }
    ]
  },
  {
    "dataId": "84",
    "nombre": "Mi Primer Hoya",
    "materiales": [
      {
        "id": "2300",
        "texto": "MI PRIMER HOYA - Array 1.50 Hilux Clear Blue Filter Add hasta 1.75"
      },
      {
        "id": "2301",
        "texto": "MI PRIMER HOYA - Array 1.50 Hilux Sensity 2 Grey Add hasta 1.75"
      },
      {
        "id": "2302",
        "texto": "MI PRIMER HOYA - Array 1.59 Hilux Clear Blue Filter Add hasta 1.75"
      },
      {
        "id": "2303",
        "texto": "MI PRIMER HOYA - Array 1.59 Hilux Sensity 2 Grey Add hasta 1.75"
      },
      {
        "id": "2304",
        "texto": "MI PRIMER HOYA - Array 1.59 Hilux Polarized Grey Add hasta 1.75"
      },
      {
        "id": "2305",
        "texto": "MI PRIMER HOYA - Array 1.59 Hilux Polarized Brown Add hasta 1.75"
      },
      {
        "id": "2306",
        "texto": "MI PRIMER HOYA - Array 1.59 Hilux Polarized Green Add hasta 1.75"
      },
      {
        "id": "2307",
        "texto": "MI PRIMER HOYA - Array 1.60 Hilux MR-8 Clear Add hasta 1.75"
      },
      {
        "id": "2308",
        "texto": "MI PRIMER HOYA - Array 1.60 Hilux MR-8 Filter 420 Add hasta 1.75"
      },
      {
        "id": "2309",
        "texto": "MI PRIMER HOYA - Array 1.60 Hilux MR-8 Sensity 2 Grey Add hasta 1.75"
      },
      {
        "id": "2310",
        "texto": "MI PRIMER HOYA - Array 1.60 Hilux MR-8 Sensity 2 Brown Add hasta 1.75"
      },
      {
        "id": "2311",
        "texto": "MI PRIMER HOYA - Array 1.60 Hilux MR-8 Sensity 2 Green Add hasta 1.75"
      },
      {
        "id": "2313",
        "texto": "MI PRIMER HOYA - Summit 1.50 Hilux Clear Blue Filter Add hasta 1.75"
      },
      {
        "id": "2314",
        "texto": "MI PRIMER HOYA - Summit 1.50 Hilux Sensity 2 Grey Add hasta 1.75"
      },
      {
        "id": "2315",
        "texto": "MI PRIMER HOYA - Summit 1.59 Hilux Clear Blue Filter Add hasta 1.75"
      },
      {
        "id": "2316",
        "texto": "MI PRIMER HOYA - Summit 1.59 Hilux Sensity 2 Grey Add hasta 1.75"
      },
      {
        "id": "2317",
        "texto": "MI PRIMER HOYA - Summit 1.59 Hilux Polarized Grey Add hasta 1.75"
      },
      {
        "id": "2318",
        "texto": "MI PRIMER HOYA - Summit 1.59 Hilux Polarized Brown Add hasta 1.75"
      },
      {
        "id": "2319",
        "texto": "MI PRIMER HOYA - Summit 1.59 Hilux Polarized Green Add hasta 1.75"
      },
      {
        "id": "2320",
        "texto": "MI PRIMER HOYA - Summit 1.60 Hilux MR-8 Clear Add hasta 1.75"
      },
      {
        "id": "2321",
        "texto": "MI PRIMER HOYA - Summit 1.60 Hilux MR-8 Filter 420 Add hasta 1.75"
      },
      {
        "id": "2322",
        "texto": "MI PRIMER HOYA - Summit 1.60 Hilux MR-8 Sensity 2 Grey Add hasta 1.75"
      },
      {
        "id": "2323",
        "texto": "MI PRIMER HOYA - Summit 1.60 Hilux MR-8 Sensity 2 Brown Add hasta 1.75"
      },
      {
        "id": "2324",
        "texto": "MI PRIMER HOYA - Summit 1.60 Hilux MR-8 Sensity 2 Green Add hasta 1.75"
      }
    ]
  }
];
