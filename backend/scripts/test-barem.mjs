import fs from 'fs';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { parseBaremMap, applyBarem } from '../src/controllers/importController.mjs';

let failures = 0;
function check(name, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) {
        console.log(`  OK   ${name}`);
    } else {
        failures++;
        console.log(`  FAIL ${name}\n       vart: ${e}\n       kapott: ${a}`);
    }
}

// --- 1) Valós barem PDF kipróbálása ---
const pdfPath = path.resolve(process.argv[2] || '../../Tetelek/Javítókulcs-ÁOK-FOK-Biológia-2021.dec.pdf');
const pdf = new PDFParse({ data: fs.readFileSync(pdfPath) });
let text;
try {
    const result = await pdf.getText();
    text = result.text;
} finally {
    if (typeof pdf.destroy === 'function') await pdf.destroy();
}

console.log('Valos barem PDF:');
const map = parseBaremMap(text);
check('100 kerdes kinyerve', Object.keys(map).length, 100);
check('1 -> BC (tobbszoros)', map[1], 'BC');
check('2 -> B (egyszeres)', map[2], 'B');
check('5 -> AB', map[5], 'AB');
check('16 -> C', map[16], 'C');
check('100 -> AB', map[100], 'AB');

// --- 2) applyBarem: tobb helyes opció jelolese ---
console.log('\napplyBarem (tobbszoros jeloles):');
const questions = [
    { num: 1, options: ['A', 'B', 'C', 'D'].map(t => ({ text: t, isCorrect: false })) },
    { num: 2, options: ['A', 'B', 'C', 'D'].map(t => ({ text: t, isCorrect: false })) },
    { num: 101, options: ['A', 'B', 'C', 'D'].map(t => ({ text: t, isCorrect: false })) }, // nincs a map-ben (tul a 100.-on)
];
applyBarem(questions, map);
check('1. kerdes: B es C helyes', questions[0].options.map(o => o.isCorrect), [false, true, true, false]);
check('2. kerdes: csak B helyes', questions[1].options.map(o => o.isCorrect), [false, true, false, false]);
check('101. kerdes: erintetlen (nincs barem)', questions[2].options.map(o => o.isCorrect), [false, false, false, false]);

// --- 3) Formatumvariansok ---
console.log('\nFormatumvariansok:');
const variants = {
    '1A 2C 3B': { 1: 'A', 2: 'C', 3: 'B' },
    '1. AB\n2. C\n3. BD': { 1: 'AB', 2: 'C', 3: 'BD' },
    '1) A, B\n2) C/D': { 1: 'AB', 2: 'CD' },
    '1: A B\n2: BC': { 1: 'AB', 2: 'BC' },
    '1.AB 2. C': { 1: 'AB', 2: 'C' },
    '10. AD\n11. BC': { 10: 'AD', 11: 'BC' },
};
for (const [input, expected] of Object.entries(variants)) {
    check(JSON.stringify(input), parseBaremMap(input), expected);
}

// --- 4) Magyar szöveg nem ragad be a betukbe ---
console.log('\nMagyar szoveg szurese:');
check('1. A bekezdés', parseBaremMap('1. A bekezdés'), { 1: 'A' });
check('2. Bármi következik', parseBaremMap('2. Bármi következik'), { 2: 'B' });

// --- 5) E betu 4 opcional nem tor ossze ---
console.log('\nHatarertekek:');
const qE = [{ num: 1, options: ['A', 'B', 'C', 'D'].map(t => ({ text: t, isCorrect: false })) }];
applyBarem(qE, { 1: 'AE' });
check('AE 4 opcioval: csak A jelolt', qE[0].options.map(o => o.isCorrect), [true, false, false, false]);

console.log(failures === 0 ? '\nMINDEN TESZT OK' : `\n${failures} TESZT HIBAS`);
process.exit(failures === 0 ? 0 : 1);
