// Uso: node scripts/generar-pin-hash.mjs <PIN 4-8 digitos>
// Mismo algoritmo que calcularHashPin() en js/storage.js (SHA-256 + sal, 10000 iteraciones).
import { createHash, randomBytes } from 'node:crypto';

const ITER = 10000;
const pin = process.argv[2] || '';
if (!/^\d{4,8}$/.test(pin)) {
  console.error('Uso: node scripts/generar-pin-hash.mjs <PIN de 4 a 8 digitos>');
  process.exit(1);
}
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');
const sal = randomBytes(16).toString('hex');
let h = sha(`${sal}:${pin}`);
for (let i = 1; i < ITER; i++) h = sha(`${h}:${sal}`);
console.log(`BARBERO_PIN_SALT=${sal}`);
console.log(`BARBERO_PIN_HASH=${h}`);