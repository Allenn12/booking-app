import fs from 'fs';

const str = fs.readFileSync('eslint_out.json', 'utf16le');
const clean = str.charCodeAt(0) === 0xFEFF ? str.slice(1) : str;
const data = JSON.parse(clean);

let out = '';
data.forEach(file => {
  file.messages.forEach(msg => {
    out += `Line ${msg.line}: ${msg.message}\n`;
  });
});
fs.writeFileSync('eslint_clean.txt', out);
