import { Router } from 'express';
import {
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  getFolderFiles,
  uploadFolderFile,
  deleteFolderFile,
} from '../controllers/folderController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { fileUpload } from '../middlewares/uploadMiddleware.js';

export const folderRouter = Router();

// All folder routes require valid user authentication
folderRouter.use(authenticate);

folderRouter.get('/', getFolders);
folderRouter.post('/', createFolder);
folderRouter.put('/:id', updateFolder);
folderRouter.delete('/:id', deleteFolder);

// Folder File Management
folderRouter.get('/:id/files', getFolderFiles);
folderRouter.post('/:id/files', fileUpload.single('file'), uploadFolderFile);
folderRouter.delete('/:id/files/:fileId', deleteFolderFile);
