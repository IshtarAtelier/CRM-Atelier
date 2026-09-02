import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import unusedImports from "eslint-plugin-unused-imports";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const eslintConfig = [
  {
    ignores: [
        ".next/**",
        // Los dev servers en puertos paralelos generan `.next-<nombre>` (ver
        // CLAUDE.md). El .gitignore ya los cubre, pero ESLint no: uno solo de
        // esos directorios metía 26 errores de un archivo generado y tapaba
        // los 5 reales.
        ".next-*/**",
        "node_modules/**",
        "build/**", 
        "out/**", 
        "public/**", 
        "next-env.d.ts",
        "tmp/**",
        "scripts/**",
        "prisma/generated/**",
        "backups/**",
        "scratch/**",
        "*.js",
        "*.mjs",
        "*.ts"
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react/no-unescaped-entities": "off",
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/interactive-supports-focus": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        { "vars": "all", "varsIgnorePattern": "^_", "args": "after-used", "argsIgnorePattern": "^_" }
      ]
    }
  },
  // ── F0-02 / R2 del plan de modernización UX (2/9/2026) ────────────────────
  //
  // `toLocaleString()` SIN idioma resuelve en-US en el Node del servidor y
  // es-AR en el navegador: el mismo número sale "$215,000" de un lado y
  // "$215.000" del otro. En Next.js eso es un error de hidratación, y un error
  // de hidratación deja los componentes cliente sin montar — que es la causa
  // raíz del bug que tuvo el nombre y el precio de la ficha congelados en
  // opacity:0 (F0-01).
  //
  // POR QUÉ SOLO EN LA TIENDA PÚBLICA Y NO EN TODO EL PROYECTO
  // Hay 262 usos en /admin. Son deuda vieja y ahí el daño es otro: el panel se
  // renderiza en el cliente y lo miran cinco personas, no el visitante que
  // viene de un anuncio. Poner la regla global convierte esos 262 en errores de
  // build de golpe. Se aplica donde cuesta plata; /admin se migra aparte.
  //
  // Para precios: `formatearPrecio()` de src/lib/format-precio.ts.
  // Para cualquier otro número: pasá 'es-AR' explícito.
  {
    files: [
      "src/app/tienda/**/*.{ts,tsx}",
      "src/app/producto/**/*.{ts,tsx}",
      "src/app/l/**/*.{ts,tsx}",
      "src/components/Storefront/**/*.{ts,tsx}",
      "src/components/checkout/**/*.{ts,tsx}",
      "src/components/cristales/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "CallExpression[callee.property.name='toLocaleString'][arguments.length=0]",
        message: "toLocaleString() sin idioma rompe la hidratación (servidor en-US vs navegador es-AR). Usá formatearPrecio() de src/lib/format-precio.ts, o pasá 'es-AR' explícito."
      }]
    }
  }
];

export default eslintConfig;
