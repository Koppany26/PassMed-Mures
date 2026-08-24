import express from 'express';
import { getStatus } from '../controllers/testController.mjs';

const router = express.Router();

// GET /api/db-status -> Adatbázis kapcsolat ellenőrzése
router.get('/db-status', getStatus);

export default router;