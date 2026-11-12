/* 
Kategóriák és kérdések útvonalai
*/

import express from 'express';
import {
    getCategories,
    getTopics,
    getBodyRegions,
    updateTopicBodyRegion,
    createCategory,
    getQuestions,
    answerTopicPractice,
    createQuestion,
    updateQuestion,
    deleteQuestion,
} from '../controllers/questionController.mjs';
import { authenticate, authorize } from '../middleware/authMiddleware.mjs';

const router = express.Router();

// Kategóriák
router.get('/categories', getCategories);
router.get('/topics', getTopics);
router.get('/body/regions', authenticate, getBodyRegions);
router.post('/categories', authenticate, authorize('TEACHER', 'ADMIN'), createCategory);
router.put('/topics/:id/body-region', authenticate, authorize('TEACHER', 'ADMIN'), updateTopicBodyRegion);

// Kérdések
router.get('/questions', authenticate, getQuestions);
router.post('/questions/:id/practice-answer', authenticate, answerTopicPractice);
router.post('/questions', authenticate, authorize('TEACHER', 'ADMIN'), createQuestion);
router.put('/questions/:id', authenticate, authorize('TEACHER', 'ADMIN'), updateQuestion);
router.delete('/questions/:id', authenticate, authorize('TEACHER', 'ADMIN'), deleteQuestion);

export default router;