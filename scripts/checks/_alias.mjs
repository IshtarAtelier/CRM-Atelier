// Engancha el resolver de alias `@/` (ver _alias-loader.mjs).
// Va en la línea de comando:  node --experimental-strip-types --import ./scripts/checks/_alias.mjs <check>
import { register } from 'node:module';
register('./_alias-loader.mjs', import.meta.url);
