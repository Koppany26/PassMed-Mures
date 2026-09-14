import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import path from 'path';
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
const frontendPath = path.join(__dirname, '../../frontend');
app.use(express.static(frontendPath));

// --- ALAP VÉGPONT (Teszteléshez) ---
app.get('/api/status', (req, res) => {
    res.status(200).json({ 
        status: 'success',
        message: 'A PassMed backend szerver fut és készen áll (ESM módban)!' 
    });
});

// --- API ÚTVONALAK ---
app.use('/api', apiRoutes);

// --- SZERVER INDÍTÁSA ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Szerver sikeresen elindult a ${PORT}-es porton.`);
});