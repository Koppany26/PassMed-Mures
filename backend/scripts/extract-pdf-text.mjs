import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';

const file = path.resolve(process.argv[2]);
const pdf = new PDFParse({ data: fs.readFileSync(file) });
try {
    const result = await pdf.getText();
    console.log(result.text);
} finally {
    if (typeof pdf.destroy === 'function') await pdf.destroy();
}
