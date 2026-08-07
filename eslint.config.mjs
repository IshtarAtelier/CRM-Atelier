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
  }
];

export default eslintConfig;
