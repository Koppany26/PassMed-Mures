import express from 'express';
import { getTopicMaterials, uploadTopicMaterial } from '../controllers/materialController.mjs';
import { fileUpload } from '../controllers/importController.mjs';
import { authenticate, authorize } from '../middleware/authMiddleware.mjs';

const router = express.Router();

router.get('/topics/:topicId', authenticate, getTopicMaterials);
router.post(
    '/topics/:topicId',
    authenticate,
    authorize('TEACHER', 'ADMIN'),
    fileUpload.single('file'),
    uploadTopicMaterial,
);

export default router;
