/* 
Teszt kitöltések útvonalai
*/

import express from 'express';
import {
    submitAttempt,
    getAttemptById,
    getMyAttempts,
} from '../controllers/attemptController.mjs';
import { authenticate } from '../middleware/authMiddleware.mjs';

const router = express.Router();

// Saját kitöltések listája
router.get('/my', authenticate, getMyAttempts);

// Kitöltés beadása
router.post('/:id/submit', authenticate, submitAttempt);

// Kitöltés részletei
router.get('/:id', authenticate, getAttemptById);

export default router;
