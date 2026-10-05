/* 
Kategóriák és kérdések útvonalai
*/

import express from 'express';
import {
    getCategories,
    createCategory,
    getQuestions,
    createQuestion,
    updateQuestion,
    deleteQuestion,
} from '../controllers/questionController.mjs';
import { authenticate, authorize } from '../middleware/authMiddleware.mjs';

const router = express.Router();

// Kategóriák
router.get('/categories', getCategories);
router.post('/categories', authenticate, authorize('TEACHER', 'ADMIN'), createCategory);

// Kérdések
router.get('/questions', getQuestions);
router.post('/questions', authenticate, authorize('TEACHER', 'ADMIN'), createQuestion);
router.put('/questions/:id', authenticate, authorize('TEACHER', 'ADMIN'), updateQuestion);
router.delete('/questions/:id', authenticate, authorize('TEACHER', 'ADMIN'), deleteQuestion);

export default router;