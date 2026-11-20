import { Router } from 'express';
import {
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
} from '../controllers/folderController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

export const folderRouter = Router();

// All folder routes require valid user authentication
folderRouter.use(authenticate);

folderRouter.get('/', getFolders);
folderRouter.post('/', createFolder);
folderRouter.put('/:id', updateFolder);
folderRouter.delete('/:id', deleteFolder);
