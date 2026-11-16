import express from 'express';
import {
    acceptGroupInvitation,
    assignTestToGroup,
    createGroup,
    deleteGroup,
    getGroupAttempts,
    getMyGroups,
    getMyInvitations,
    inviteToGroup,
    joinGroupByCode,
} from '../controllers/groupController.mjs';
import { authenticate, authorize } from '../middleware/authMiddleware.mjs';

const router = express.Router();

router.use(authenticate);
router.get('/', getMyGroups);
router.get('/invitations', authorize('STUDENT'), getMyInvitations);
router.post('/invitations/:invitationId/accept', authorize('STUDENT'), acceptGroupInvitation);
router.post('/join', authorize('STUDENT'), joinGroupByCode);
router.post('/', authorize('TEACHER', 'ADMIN'), createGroup);
router.delete('/:groupId', authorize('TEACHER', 'ADMIN'), deleteGroup);
router.post('/:groupId/invitations', authorize('TEACHER', 'ADMIN'), inviteToGroup);
router.post('/:groupId/tests', authorize('TEACHER', 'ADMIN'), assignTestToGroup);
router.get('/:groupId/attempts', authorize('TEACHER', 'ADMIN'), getGroupAttempts);

export default router;
