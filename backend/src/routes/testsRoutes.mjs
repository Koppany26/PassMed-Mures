/* 
Teszt útvonalai
*/

import express from 'express';
import {
    getTests,
    createStudentPracticeTest,
    createTest,
    updateTest,
    updateTestQuestion,
    getTestById,
    addQuestionToTest,
    removeQuestionFromTest,
    deleteTest,
} from '../controllers/testsController.mjs';
import { startAttempt } from '../controllers/attemptController.mjs';
import {
    createTestReport,
    getOpenTestReports,
    resolveTestReport,
} from '../controllers/testReportController.mjs';
import { authenticate, authorize } from '../middleware/authMiddleware.mjs';

const router = express.Router();

// Tesztek
router.get('/', authenticate, getTests);
router.post('/practice', authenticate, authorize('STUDENT'), createStudentPracticeTest);
router.get('/reports/inbox', authenticate, authorize('TEACHER', 'ADMIN'), getOpenTestReports);
router.patch('/reports/:reportId/resolve', authenticate, authorize('TEACHER', 'ADMIN'), resolveTestReport);
router.get('/:id', authenticate, getTestById);
router.post('/', authenticate, authorize('TEACHER', 'ADMIN'), createTest);
router.post('/:id/reports', authenticate, createTestReport);
router.put('/:id', authenticate, authorize('TEACHER', 'ADMIN'), updateTest);
router.put('/:id/questions/:questionId', authenticate, authorize('TEACHER', 'ADMIN'), updateTestQuestion);
router.delete('/:id', authenticate, authorize('TEACHER', 'ADMIN'), deleteTest);

// Kérdések hozzáadása/eltávolítása teszthez
router.post('/:id/questions', authenticate, authorize('TEACHER', 'ADMIN'), addQuestionToTest);
router.delete('/:id/questions/:questionId', authenticate, authorize('TEACHER', 'ADMIN'), removeQuestionFromTest);

// Kitöltés indítása
router.post('/:id/attempts', authenticate, authorize('STUDENT'), startAttempt);

export default router;