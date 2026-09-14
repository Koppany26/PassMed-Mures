/* 
Teszt útvonalai
*/

import express from 'express';
import {
    getTests,
    createTest,
    getTestById,
    addQuestionToTest,
    removeQuestionFromTest,
    deleteTest,
} from '../controllers/testsController.mjs';
import { startAttempt } from '../controllers/attemptController.mjs';
import { authenticate, authorize } from '../middleware/authMiddleware.mjs';

const router = express.Router();

// Tesztek
router.get('/', getTests);
router.get('/:id', authenticate, getTestById);
router.post('/', authenticate, authorize('TANAR', 'ADMIN'), createTest);
router.delete('/:id', authenticate, authorize('TANAR', 'ADMIN'), deleteTest);

// Kérdések hozzáadása/eltávolítása teszthez
router.post('/:id/questions', authenticate, authorize('TANAR', 'ADMIN'), addQuestionToTest);
router.delete('/:id/questions/:kerdesId', authenticate, authorize('TANAR', 'ADMIN'), removeQuestionFromTest);

// Kitöltés indítása
router.post('/:id/attempts', authenticate, startAttempt);

export default router;
