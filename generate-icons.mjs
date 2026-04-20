import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svgFile = path.resolve('public/favicon.svg');
const out192 = path.resolve('public/pwa-192x192.png');
const out512 = path.resolve('public/pwa-512x512.png');

async function generate() {
  const svgBuffer = fs.readFileSync(svgFile);
  
  await sharp(svgBuffer)
    .resize(192, 192)
    .toFile(out192);
        
  await sharp(svgBuffer)
    .resize(512, 512)
    .toFile(out512);
    
  console.log('Icons generated successfully.');
}

generate().catch(console.error);
