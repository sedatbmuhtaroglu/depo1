/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const directory = path.join(__dirname, 'src');

const MAP = {
  'Ã¼': 'ü',
  'Ãœ': 'Ü',
  'Ã¶': 'ö',
  'Ã–': 'Ö',
  'Ã§': 'ç',
  'Ã‡': 'Ç',
  'Ä±': 'ı',
  'Ä°': 'İ',
  'ÅŸ': 'ş',
  'Åž': 'Ş',
  'ÄŸ': 'ğ',
  'Äž': 'Ğ',
  'Ã¢': 'â',
  'Ã®': 'î',
  'Ã»': 'û',
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  
  // Skip the fixer function file to avoid breaking it, unless it has other words
  const isFixer = filePath.includes('person-display-name.ts');
  
  if (!isFixer) {
    for (const [bad, good] of Object.entries(MAP)) {
      content = content.split(bad).join(good);
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  }
}

function walk(dir) {
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      walk(filePath);
    } else {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        processFile(filePath);
      }
    }
  });
}

walk(directory);
console.log('Mojibake fix complete.');
