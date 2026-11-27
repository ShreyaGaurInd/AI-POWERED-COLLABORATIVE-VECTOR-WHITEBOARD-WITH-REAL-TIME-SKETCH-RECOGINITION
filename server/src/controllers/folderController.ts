import { Request, Response } from 'express';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db.js';

// Validation schemas for folders
const folderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(50, 'Folder name too long'),
  color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i, 'Valid hex color required').optional(),
});

/**
 * List all folders belonging to the authenticated user
 * GET /api/folders
 */
export async function getFolders(req: Request, res: Response) {
  const userId = req.user!.id;

  const folders = await prisma.folder.findMany({
    where: { userId },
    include: {
      _count: {
        select: { whiteboards: true, files: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    success: true,
    data: {
      folders: folders.map((f) => ({
        id: f.id,
        name: f.name,
        color: f.color,
        whiteboardCount: f._count.whiteboards,
        fileCount: f._count.files,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
    },
  });
}

/**
 * Create a new folder
 * POST /api/folders
 */
export async function createFolder(req: Request, res: Response) {
  const userId = req.user!.id;
  const { name, color } = folderSchema.parse(req.body);

  const folder = await prisma.folder.create({
    data: {
      userId,
      name: name.trim(),
      color: color || '#3b82f6', // Default accent blue
    },
    include: {
      _count: {
        select: { whiteboards: true },
      },
    },
  });

  return res.status(201).json({
    success: true,
    message: 'Folder created successfully',
    data: {
      folder: {
        id: folder.id,
        name: folder.name,
        color: folder.color,
        whiteboardCount: folder._count.whiteboards,
        createdAt: folder.createdAt,
      },
    },
  });
}

/**
 * Rename / update a folder
 * PUT /api/folders/:id
 */
export async function updateFolder(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;
  const { name, color } = folderSchema.parse(req.body);

  // Verify ownership
  const existing = await prisma.folder.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== userId) {
    return res.status(404).json({
      success: false,
      message: 'Folder not found or you do not have permission to modify it.',
    });
  }

  const updated = await prisma.folder.update({
    where: { id },
    data: {
      name: name.trim(),
      ...(color ? { color } : {}),
    },
    include: {
      _count: {
        select: { whiteboards: true },
      },
    },
  });

  return res.json({
    success: true,
    message: 'Folder updated successfully',
    data: {
      folder: {
        id: updated.id,
        name: updated.name,
        color: updated.color,
        whiteboardCount: updated._count.whiteboards,
        updatedAt: updated.updatedAt,
      },
    },
  });
}

/**
 * Delete a folder
 * DELETE /api/folders/:id
 * Safely unlinks any whiteboards inside it back to the root level (folderId: null)
 */
export async function deleteFolder(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  const existing = await prisma.folder.findUnique({
    where: { id },
  });

  if (!existing || existing.userId !== userId) {
    return res.status(404).json({
      success: false,
      message: 'Folder not found or you do not have permission to delete it.',
    });
  }

  // Transaction: Unlink whiteboards from folder, then delete folder
  await prisma.$transaction([
    prisma.whiteboard.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    }),
    prisma.folder.delete({
      where: { id },
    }),
  ]);

  return res.json({
    success: true,
    message: 'Folder deleted and whiteboards moved to root level.',
  });
}

/**
 * List all files in a folder
 * GET /api/folders/:id/files
 */
export async function getFolderFiles(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  const folder = await prisma.folder.findUnique({
    where: { id },
  });

  if (!folder || folder.userId !== userId) {
    return res.status(404).json({
      success: false,
      message: 'Folder not found.',
    });
  }

  const files = await prisma.folderFile.findMany({
    where: { folderId: id },
    include: {
      user: {
        select: { id: true, fullName: true, avatarColor: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    success: true,
    data: { files },
  });
}

/**
 * Upload a file into a folder (PDF, TXT, DOCX, images, etc.)
 * POST /api/folders/:id/files
 */
export async function uploadFolderFile(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded. Please choose a file.',
    });
  }

  const folder = await prisma.folder.findUnique({
    where: { id },
  });

  if (!folder || folder.userId !== userId) {
    // Clean up uploaded file if folder invalid
    if (req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(404).json({
      success: false,
      message: 'Folder not found.',
    });
  }

  // Construct URL accessible via Express static /uploads
  const fileUrl = `/uploads/folder-files/${req.file.filename}`;

  const createdFile = await prisma.folderFile.create({
    data: {
      folderId: id,
      userId,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      fileUrl,
    },
    include: {
      user: {
        select: { id: true, fullName: true, avatarColor: true },
      },
    },
  });

  return res.status(201).json({
    success: true,
    message: `File "${req.file.originalname}" uploaded successfully!`,
    data: { file: createdFile },
  });
}

/**
 * Delete a file from a folder
 * DELETE /api/folders/:id/files/:fileId
 */
export async function deleteFolderFile(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id, fileId } = req.params;

  const file = await prisma.folderFile.findUnique({
    where: { id: fileId },
    include: { folder: true },
  });

  if (!file || file.folderId !== id || file.folder.userId !== userId) {
    return res.status(404).json({
      success: false,
      message: 'File not found.',
    });
  }

  // Delete physical file on disk
  try {
    const filename = path.basename(file.fileUrl);
    const diskPath = path.join(process.cwd(), 'uploads', 'folder-files', filename);
    if (fs.existsSync(diskPath)) {
      fs.unlinkSync(diskPath);
    }
  } catch (err) {
    console.error('Error deleting file from disk:', err);
  }

  // Delete from DB
  await prisma.folderFile.delete({
    where: { id: fileId },
  });

  return res.json({
    success: true,
    message: 'File deleted successfully.',
  });
}
