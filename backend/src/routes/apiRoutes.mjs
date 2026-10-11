import express from 'express';
import { getStatus } from '../controllers/testController.mjs';
import authRoutes from './authRoutes.mjs';
import questionRoutes from './questionRoutes.mjs';
import importRoutes from './importRoutes.mjs';
import testsRoutes from './testsRoutes.mjs';
import attemptRoutes from './attemptRoutes.mjs';

const router = express.Router();

// GET /api/db-status -> Adatbázis kapcsolat ellenőrzése
router.get('/db-status', getStatus);

// POST /api/auth/register és /api/auth/login -> Hitelesítés
router.use('/auth', authRoutes);

// Kategóriák és kérdések
router.use('/', questionRoutes);

// Tesztimport (feltöltés + beolvasás) — ELSŐBB, mint a /tests routeok, hogy a /tests/import ne ütközdjön a /tests/:id routeol
router.use('/tests/import', importRoutes);

// Tesztek
router.use('/tests', testsRoutes);

// Kitöltések
router.use('/attempts', attemptRoutes);

export default router;