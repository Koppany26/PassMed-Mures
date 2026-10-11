/* 
Tesztimport útvonalai (tanár/admin)
*/

import express from 'express';
import {
    fileUpload,
    uploadTest,
    uploadAnswerKey,
    approveImport,
    getImportPreview,
} from '../controllers/importController.mjs';
import { authenticate, authorize } from '../middleware/authMiddleware.mjs';

const router = express.Router();

// Minden import-művelet csak tanár/admin számára érhető el
router.use(authenticate, authorize('TEACHER', 'ADMIN'));

// Teszt feltöltése + elemzés
router.post('/', fileUpload.single('file'), uploadTest);

// Előnézet lekérése token alapján
router.get('/:token', getImportPreview);

// Javítókulcs feltöltése (külön fájl)
router.post('/:token/answer-key', fileUpload.single('file'), uploadAnswerKey);

// Jóváhagyás + mentés az adatbázisba
router.post('/:token/approve', approveImport);

export default router;