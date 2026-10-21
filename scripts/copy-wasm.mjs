// Copie le moteur de lecture des codes-barres (ZXing-C++ WebAssembly) dans public/wasm :
// servi par l'app elle-même, il fonctionne hors ligne (pas de CDN). Lancé après chaque npm install.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const source = require.resolve("zxing-wasm/reader/zxing_reader.wasm");
mkdirSync("public/wasm", { recursive: true });
copyFileSync(source, "public/wasm/zxing_reader.wasm");
