import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import apiRoutes from './routes/apiRoutes.mjs';

// Környezeti változók betöltése
dotenv.config();

// Szerver példányosítása
const app = express();

// --- MIDDLEWARE-EK ---
app.use(cors());
app.use(express.json());

// --- STATIKUS FRONTEND KISZOLGÁLÁSA ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Próbáljuk több helyről is megtalálni a frontend mappát
const possiblePaths = [
    path.join(__dirname, '../../frontend'),   // backend/src -> frontend
    path.join(process.cwd(), 'frontend'),     // cwd -> frontend
    path.join(process.cwd(), '../frontend'),  // cwd/.. -> frontend
];

let frontendPath = null;
for (const p of possiblePaths) {
    try {
        if (fs.existsSync(p)) {
            frontendPath = p;
            break;
        }
    } catch (e) {
        // continue
    }
}

if (frontendPath) {
    console.log(`Frontend kiszolgálása innen: ${frontendPath}`);
    app.use(express.static(frontendPath));
} else {
    console.warn('FIGYELEM: A frontend mappa nem található!');
}

// Feltöltött fájlok (tesztek / javítókulcsok) statikus kiszolgálása
const uploadsPath = path.join(__dirname, '../uploads');
if (fs.existsSync(uploadsPath)) {
    app.use('/uploads', express.static(uploadsPath));
}

// --- ALAP VÉGPONT (Teszteléshez) ---
app.get('/api/status', (req, res) => {
    res.status(200).json({ 
        status: 'success',
        message: 'A PassMed backend szerver fut és készen áll (ESM módban)!' 
    });
});

// --- API ÚTVONALAK ---
app.use('/api', apiRoutes);

// --- FALLBACK: nem API kéréseknél a kért fájlt, vagy ha nincs, az index.html-t adjuk vissza ---
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    if (!frontendPath) {
        return res.status(404).json({ success: false, message: 'Frontend nem található.' });
    }

    // Ha a kért útvonal egy létező fájl, azt szolgáljuk ki
    const requestedFile = path.join(frontendPath, req.path);
    if (fs.existsSync(requestedFile) && fs.statSync(requestedFile).isFile()) {
        return res.sendFile(requestedFile);
    }

    // Különben az index.html-t adjuk vissza (SPA fallback)
    res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- SZERVER INDÍTÁSA ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Szerver sikeresen elindult a ${PORT}-es porton.`);
});