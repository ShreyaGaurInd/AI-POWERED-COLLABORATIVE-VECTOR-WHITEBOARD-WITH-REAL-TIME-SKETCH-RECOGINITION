import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  getFriends,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  removeFriend,
  getDirectMessages,
  sendDirectMessage,
} from '../controllers/friendController.js';

export const friendRouter = Router();

friendRouter.use(requireAuth);

friendRouter.get('/', getFriends);
friendRouter.get('/search', searchUsers);
friendRouter.post('/request', sendFriendRequest);
friendRouter.post('/accept', acceptFriendRequest);
friendRouter.post('/reject', rejectFriendRequest);
friendRouter.delete('/:friendId', removeFriend);
friendRouter.get('/:friendId/messages', getDirectMessages);
friendRouter.post('/:friendId/messages', sendDirectMessage);
