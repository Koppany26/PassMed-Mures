import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import apiRoutes from './routes/apiRoutes.mjs'; // <-- Ezt add hozzá!

// Környezeti változók betöltése
dotenv.config();

// Szerver példányosítása
const app = express();

// --- MIDDLEWARE-EK ---
app.use(cors());
app.use(express.json());

// --- ALAP VÉGPONT (Teszteléshez) ---
app.get('/api/status', (req, res) => {
    res.status(200).json({ 
        status: 'success',
        message: 'A PassMed backend szerver fut és készen áll (ESM módban)!' 
    });
});

// --- API ÚTVONALAK ---
app.use('/api', apiRoutes); // <-- Ez kapcsolja be a /api/db-status végpontot

// --- SZERVER INDÍTÁSA ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Szerver sikeresen elindult a ${PORT}-es porton.`);
});