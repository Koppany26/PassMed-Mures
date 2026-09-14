/* 
regisztráció és a bejelentkezés
*/

import express from 'express';
import { registerUser, loginUser, getMe } from '../controllers/authController.mjs';
import { authenticate } from '../middleware/authMiddleware.mjs';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', authenticate, getMe);

export default router;