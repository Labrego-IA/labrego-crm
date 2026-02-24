#!/usr/bin/env node

/**
 * Script para gerar ícones da extensão
 * Requer: npm install canvas
 * Uso: node generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Tentar usar canvas se disponível
let createCanvas;
try {
  createCanvas = require('canvas').createCanvas;
} catch {
  console.log('Canvas não disponível. Use o generate-icons.html no navegador.');
  console.log('Ou instale com: npm install canvas');

  // Criar ícones placeholder simples (1x1 pixel verde)
  const sizes = [16, 32, 48, 128];
  const iconsDir = path.join(__dirname, '..', 'icons');

  // PNG header mínimo (1x1 pixel verde)
  const greenPixelPng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimension
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
    0x54, 0x08, 0xD7, 0x63, 0x28, 0xE6, 0x58, 0x00,
    0x00, 0x00, 0x84, 0x00, 0x81, 0x19, 0x5F, 0x68,
    0x9D, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, // IEND chunk
    0x44, 0xAE, 0x42, 0x60, 0x82
  ]);

  sizes.forEach(size => {
    const filename = path.join(iconsDir, `icon${size}.png`);
    fs.writeFileSync(filename, greenPixelPng);
    console.log(`Placeholder criado: ${filename}`);
  });

  console.log('\nNota: Estes são placeholders. Para ícones reais:');
  console.log('1. Abra generate-icons.html no navegador');
  console.log('2. Baixe os ícones gerados');
  console.log('3. Substitua os arquivos na pasta icons/');

  process.exit(0);
}

// Se canvas está disponível, gerar ícones reais
const sizes = [16, 32, 48, 128];
const iconsDir = path.join(__dirname, '..', 'icons');

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Gradient background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#25D366');
  gradient.addColorStop(1, '#075E54');

  // Rounded rectangle
  const radius = size * 0.1875;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Letter G
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.5625}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('G', size / 2, size / 2 + size * 0.05);

  // Save PNG
  const buffer = canvas.toBuffer('image/png');
  const filename = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(filename, buffer);
  console.log(`Ícone gerado: ${filename}`);
});

console.log('\nÍcones gerados com sucesso!');
