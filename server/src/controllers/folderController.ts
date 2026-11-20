import { Request, Response } from 'express';
import { z } from 'zod';
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
        select: { whiteboards: true },
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
