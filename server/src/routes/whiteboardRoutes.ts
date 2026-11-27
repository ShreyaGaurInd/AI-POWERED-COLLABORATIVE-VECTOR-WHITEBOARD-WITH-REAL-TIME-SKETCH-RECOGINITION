import { Router } from 'express';
import {
  getWhiteboards,
  createWhiteboard,
  updateWhiteboard,
  moveWhiteboard,
  deleteWhiteboard,
  verifyBoardAccess,
  getBoardChat,
  sendBoardChatMessage,
  getBoardTodos,
  createBoardTodo,
  toggleBoardTodo,
  deleteBoardTodo,
  getBoardMembers,
  addBoardMember,
  removeBoardMember,
  getMyInvites,
  respondToInvite,
  updateLinkAccess,
} from '../controllers/whiteboardController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

export const whiteboardRouter = Router();

// All whiteboard routes require authenticated user
whiteboardRouter.use(authenticate);

whiteboardRouter.get('/', getWhiteboards);
whiteboardRouter.post('/', createWhiteboard);
whiteboardRouter.put('/:id', updateWhiteboard);
whiteboardRouter.put('/:id/move', moveWhiteboard);
whiteboardRouter.delete('/:id', deleteWhiteboard);
whiteboardRouter.post('/:id/verify-access', verifyBoardAccess);

// Link access control
whiteboardRouter.patch('/:id/link-access', updateLinkAccess);

// Whiteboard Collaborator / Member Management
whiteboardRouter.get('/:id/members', getBoardMembers);
whiteboardRouter.post('/:id/members', addBoardMember);
whiteboardRouter.delete('/:id/members/:memberId', removeBoardMember);

// Board Invites (confirm before joining)
whiteboardRouter.get('/invites/my', getMyInvites);
whiteboardRouter.patch('/invites/:inviteId', respondToInvite);

// Whiteboard Collaborative Chat
whiteboardRouter.get('/:id/chat', getBoardChat);
whiteboardRouter.post('/:id/chat', sendBoardChatMessage);

// Whiteboard Collaborative To-Do Checklist
whiteboardRouter.get('/:id/todos', getBoardTodos);
whiteboardRouter.post('/:id/todos', createBoardTodo);
whiteboardRouter.patch('/:id/todos/:todoId', toggleBoardTodo);
whiteboardRouter.delete('/:id/todos/:todoId', deleteBoardTodo);
