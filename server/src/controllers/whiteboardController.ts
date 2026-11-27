import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/db.js';
import { ENV } from '../config/env.js';

// Validation schemas
const createBoardSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
  folderId: z.string().nullable().optional(),
  password: z.string().optional(),
});

const updateBoardSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title too long'),
});

const moveBoardSchema = z.object({
  folderId: z.string().nullable(),
});

const verifyAccessSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

/**
 * List all whiteboards accessible to the authenticated user
 * (Owned boards + Shared boards)
 * GET /api/whiteboards
 */
export async function getWhiteboards(req: Request, res: Response) {
  const userId = req.user!.id;
  const folderId = req.query.folderId as string | undefined;

  const whereClause: any = {
    OR: [
      { ownerId: userId },
      { members: { some: { userId } } },
    ],
  };

  if (folderId !== undefined) {
    whereClause.folderId = folderId === 'root' ? null : folderId;
  }

  const boards = await prisma.whiteboard.findMany({
    where: whereClause,
    include: {
      folder: {
        select: { id: true, name: true, color: true },
      },
      owner: {
        select: { id: true, fullName: true, avatarColor: true },
      },
      members: {
        where: { userId },
        select: { role: true },
      },
      _count: {
        select: { members: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return res.json({
    success: true,
    data: {
      whiteboards: boards.map((b) => ({
        id: b.id,
        title: b.title,
        isProtected: b.isProtected,
        linkAccess: b.linkAccess,
        isOwner: b.ownerId === userId,
        userRole: b.ownerId === userId ? 'OWNER' : b.members[0]?.role || 'VIEWER',
        folder: b.folder,
        owner: b.owner,
        memberCount: b._count.members,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
    },
  });
}

/**
 * Create a new whiteboard
 * POST /api/whiteboards
 */
export async function createWhiteboard(req: Request, res: Response) {
  const userId = req.user!.id;
  const { title, folderId, password } = createBoardSchema.parse(req.body);

  // If a folderId was provided, verify user owns that folder
  if (folderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });
    if (!folder || folder.userId !== userId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid folder selected.',
      });
    }
  }

  // Handle optional password protection (hashed with bcrypt 10 salt rounds)
  let passwordHash: string | null = null;
  let isProtected = false;

  if (password && password.trim().length > 0) {
    isProtected = true;
    passwordHash = await bcrypt.hash(password.trim(), 10);
  }

  // Create board and add owner to whiteboard_members inside a single transaction
  const newBoard = await prisma.$transaction(async (tx) => {
    const board = await tx.whiteboard.create({
      data: {
        ownerId: userId,
        folderId: folderId || null,
        title: title.trim(),
        passwordHash,
        isProtected,
      },
      include: {
        folder: {
          select: { id: true, name: true, color: true },
        },
        owner: {
          select: { id: true, fullName: true, avatarColor: true },
        },
      },
    });

    await tx.whiteboardMember.create({
      data: {
        boardId: board.id,
        userId,
        role: 'OWNER',
      },
    });

    return board;
  });

  return res.status(201).json({
    success: true,
    message: 'Whiteboard created successfully',
    data: {
      whiteboard: {
        id: newBoard.id,
        title: newBoard.title,
        isProtected: newBoard.isProtected,
        isOwner: true,
        userRole: 'OWNER',
        folder: newBoard.folder,
        owner: newBoard.owner,
        memberCount: 1,
        createdAt: newBoard.createdAt,
        updatedAt: newBoard.updatedAt,
      },
    },
  });
}

/**
 * Rename whiteboard
 * PUT /api/whiteboards/:id
 */
export async function updateWhiteboard(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;
  const { title } = updateBoardSchema.parse(req.body);

  // Check permissions: Owner or Editor can rename
  const board = await prisma.whiteboard.findUnique({
    where: { id },
    include: {
      members: {
        where: { userId },
      },
    },
  });

  if (!board) {
    return res.status(404).json({ success: false, message: 'Whiteboard not found' });
  }

  const isOwner = board.ownerId === userId;
  const isEditor = board.members.some((m) => m.role === 'EDITOR' || m.role === 'OWNER');

  if (!isOwner && !isEditor) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to modify this whiteboard.',
    });
  }

  const updated = await prisma.whiteboard.update({
    where: { id },
    data: { title: title.trim() },
    include: {
      folder: { select: { id: true, name: true, color: true } },
    },
  });

  return res.json({
    success: true,
    message: 'Whiteboard updated successfully',
    data: {
      whiteboard: {
        id: updated.id,
        title: updated.title,
        folder: updated.folder,
        updatedAt: updated.updatedAt,
      },
    },
  });
}

/**
 * Move whiteboard to a different folder
 * PUT /api/whiteboards/:id/move
 */
export async function moveWhiteboard(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;
  const { folderId } = moveBoardSchema.parse(req.body);

  const board = await prisma.whiteboard.findUnique({
    where: { id },
  });

  if (!board || board.ownerId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Only the whiteboard owner can move it between folders.',
    });
  }

  // If moving into a folder, verify that folder exists and belongs to user
  if (folderId) {
    const folder = await prisma.folder.findUnique({
      where: { id: folderId },
    });
    if (!folder || folder.userId !== userId) {
      return res.status(400).json({
        success: false,
        message: 'Target folder not found.',
      });
    }
  }

  const updated = await prisma.whiteboard.update({
    where: { id },
    data: { folderId: folderId || null },
    include: {
      folder: { select: { id: true, name: true, color: true } },
    },
  });

  return res.json({
    success: true,
    message: 'Whiteboard moved successfully',
    data: {
      whiteboard: {
        id: updated.id,
        title: updated.title,
        folder: updated.folder,
      },
    },
  });
}

/**
 * Delete a whiteboard
 * DELETE /api/whiteboards/:id
 */
export async function deleteWhiteboard(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  const board = await prisma.whiteboard.findUnique({
    where: { id },
  });

  if (!board || board.ownerId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Only the whiteboard owner can delete it.',
    });
  }

  await prisma.whiteboard.delete({
    where: { id },
  });

  return res.json({
    success: true,
    message: 'Whiteboard deleted successfully.',
  });
}

/**
 * Verify password for a protected whiteboard
 * POST /api/whiteboards/:id/verify-access
 */
export async function verifyBoardAccess(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;
  const { password } = verifyAccessSchema.parse(req.body);

  const board = await prisma.whiteboard.findUnique({
    where: { id },
  });

  if (!board) {
    return res.status(404).json({ success: false, message: 'Whiteboard not found' });
  }

  if (!board.isProtected || !board.passwordHash) {
    return res.json({
      success: true,
      message: 'This board is not password protected.',
      data: {
        boardSessionToken: jwt.sign(
          { boardId: board.id, userId, access: 'GRANTED' },
          ENV.JWT_SECRET,
          { expiresIn: '24h' }
        ),
      },
    });
  }

  // Compare password with bcrypt hash
  const isMatch = await bcrypt.compare(password.trim(), board.passwordHash);
  if (!isMatch) {
    return res.status(401).json({
      success: false,
      message: 'Incorrect whiteboard password. Access denied.',
    });
  }

  // Issue a 24h Board Session Token for unlocked access
  const boardSessionToken = jwt.sign(
    { boardId: board.id, userId, access: 'GRANTED' },
    ENV.JWT_SECRET,
    { expiresIn: '24h' }
  );

  return res.json({
    success: true,
    message: 'Password verified. Access granted.',
    data: {
      boardSessionToken,
    },
  });
}

/**
 * Get chat messages for a whiteboard
 * GET /api/whiteboards/:id/chat
 */
export async function getBoardChat(req: Request, res: Response) {
  const { id: boardId } = req.params;

  const messages = await prisma.boardChatMessage.findMany({
    where: { boardId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          avatarColor: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  return res.json({
    success: true,
    data: { messages },
  });
}

/**
 * Send a chat message on a whiteboard
 * POST /api/whiteboards/:id/chat
 */
export async function sendBoardChatMessage(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id: boardId } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message content is required.' });
  }

  const created = await prisma.boardChatMessage.create({
    data: {
      boardId,
      userId,
      message: message.trim(),
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          avatarColor: true,
          email: true,
        },
      },
    },
  });

  return res.status(201).json({
    success: true,
    data: created,
  });
}

/**
 * Get to-do checklist items for a whiteboard
 * GET /api/whiteboards/:id/todos
 */
export async function getBoardTodos(req: Request, res: Response) {
  const { id: boardId } = req.params;

  const todos = await prisma.boardTodoItem.findMany({
    where: { boardId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return res.json({
    success: true,
    data: { todos },
  });
}

/**
 * Create a to-do item for a whiteboard
 * POST /api/whiteboards/:id/todos
 */
export async function createBoardTodo(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id: boardId } = req.params;
  const { task } = req.body;

  if (!task || !task.trim()) {
    return res.status(400).json({ success: false, message: 'Task text is required.' });
  }

  const created = await prisma.boardTodoItem.create({
    data: {
      boardId,
      userId,
      task: task.trim(),
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  return res.status(201).json({
    success: true,
    data: created,
  });
}

/**
 * Toggle completion status of a to-do item
 * PATCH /api/whiteboards/:id/todos/:todoId
 */
export async function toggleBoardTodo(req: Request, res: Response) {
  const { todoId } = req.params;
  const { completed } = req.body;

  const updated = await prisma.boardTodoItem.update({
    where: { id: todoId },
    data: {
      completed: typeof completed === 'boolean' ? completed : undefined,
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  });

  return res.json({
    success: true,
    data: updated,
  });
}

/**
 * Delete a to-do item
 * DELETE /api/whiteboards/:id/todos/:todoId
 */
export async function deleteBoardTodo(req: Request, res: Response) {
  const { todoId } = req.params;

  await prisma.boardTodoItem.delete({
    where: { id: todoId },
  });

  return res.json({
    success: true,
    message: 'To-do item deleted successfully.',
  });
}

/**
 * List all members / collaborators on a whiteboard
 * GET /api/whiteboards/:id/members
 */
export async function getBoardMembers(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;

  const board = await prisma.whiteboard.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, fullName: true, email: true, avatarColor: true } },
      members: {
        include: {
          user: { select: { id: true, fullName: true, email: true, avatarColor: true } },
        },
        orderBy: { invitedAt: 'asc' },
      },
    },
  });

  if (!board) {
    return res.status(404).json({ success: false, message: 'Whiteboard not found.' });
  }

  // Verify caller has access
  const isOwner = board.ownerId === userId;
  const isMember = board.members.some((m) => m.userId === userId);
  if (!isOwner && !isMember) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  return res.json({
    success: true,
    data: {
      owner: board.owner,
      isOwner,
      linkAccess: board.linkAccess,
      members: board.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        role: m.role,
        invitedAt: m.invitedAt,
        user: m.user,
      })),
    },
  });
}

/**
 * Add / Invite a collaborator to a whiteboard (without needing to be friends first)
 * Now creates a PENDING invite rather than directly adding the member.
 * POST /api/whiteboards/:id/members
 * Body: { emailOrName: string, role?: 'EDITOR' | 'VIEWER' }
 */
export async function addBoardMember(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;
  const { emailOrName, role = 'EDITOR' } = req.body;

  if (!emailOrName || typeof emailOrName !== 'string' || !emailOrName.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Please provide the user email or full name to invite.',
    });
  }

  const query = emailOrName.trim().toLowerCase();

  const board = await prisma.whiteboard.findUnique({
    where: { id },
    include: {
      members: true,
    },
  });

  if (!board) {
    return res.status(404).json({ success: false, message: 'Whiteboard not found.' });
  }

  // Only OWNER or EDITOR can invite collaborators
  const isOwner = board.ownerId === userId;
  const userMember = board.members.find((m) => m.userId === userId);
  if (!isOwner && (!userMember || userMember.role !== 'EDITOR')) {
    return res.status(403).json({
      success: false,
      message: 'Only the board owner or editors can invite collaborators.',
    });
  }

  // Find the target user by email or full name
  const targetUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: query },
        { fullName: { contains: query } },
      ],
    },
    select: { id: true, fullName: true, email: true, avatarColor: true },
  });

  if (!targetUser) {
    return res.status(404).json({
      success: false,
      message: `No user found matching "${emailOrName}". Please check the spelling or ask them to register first.`,
    });
  }

  // Check if target user is the board owner
  if (targetUser.id === board.ownerId) {
    return res.status(400).json({
      success: false,
      message: `${targetUser.fullName} is already the owner of this whiteboard.`,
    });
  }

  // Check if already a member
  const existingMember = await prisma.whiteboardMember.findFirst({
    where: { boardId: id, userId: targetUser.id },
  });
  if (existingMember) {
    return res.status(400).json({
      success: false,
      message: `${targetUser.fullName} is already a collaborator on this whiteboard.`,
    });
  }

  const memberRole = role === 'VIEWER' ? 'VIEWER' : 'EDITOR';

  // Check if a pending invite already exists
  const existingInvite = await prisma.boardInvite.findUnique({
    where: { boardId_inviteeId: { boardId: id, inviteeId: targetUser.id } },
  });

  if (existingInvite && existingInvite.status === 'PENDING') {
    return res.status(400).json({
      success: false,
      message: `An invite has already been sent to ${targetUser.fullName}. Waiting for their response.`,
    });
  }

  // Upsert invite (re-invite if previously declined)
  const invite = await prisma.boardInvite.upsert({
    where: { boardId_inviteeId: { boardId: id, inviteeId: targetUser.id } },
    create: {
      boardId: id,
      invitedBy: userId,
      inviteeId: targetUser.id,
      role: memberRole as any,
      status: 'PENDING',
    },
    update: {
      invitedBy: userId,
      role: memberRole as any,
      status: 'PENDING',
    },
    include: {
      invitee: { select: { id: true, fullName: true, email: true, avatarColor: true } },
    },
  });

  return res.status(201).json({
    success: true,
    message: `Invite sent to ${targetUser.fullName}! They need to accept before joining.`,
    data: {
      invite: {
        id: invite.id,
        inviteeId: invite.inviteeId,
        role: invite.role,
        status: invite.status,
        user: invite.invitee,
      },
    },
  });
}

/**
 * Get all pending board invites for the authenticated user
 * GET /api/whiteboards/invites
 */
export async function getMyInvites(req: Request, res: Response) {
  const userId = req.user!.id;

  const invites = await prisma.boardInvite.findMany({
    where: { inviteeId: userId, status: 'PENDING' },
    include: {
      board: { select: { id: true, title: true } },
      inviter: { select: { id: true, fullName: true, avatarColor: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({
    success: true,
    data: {
      invites: invites.map((inv) => ({
        id: inv.id,
        boardId: inv.boardId,
        boardTitle: inv.board.title,
        role: inv.role,
        status: inv.status,
        invitedBy: inv.inviter,
        createdAt: inv.createdAt,
      })),
    },
  });
}

/**
 * Accept or decline a board invite
 * PATCH /api/whiteboards/invites/:inviteId
 * Body: { action: 'accept' | 'decline' }
 */
export async function respondToInvite(req: Request, res: Response) {
  const userId = req.user!.id;
  const { inviteId } = req.params;
  const { action } = req.body;

  if (action !== 'accept' && action !== 'decline') {
    return res.status(400).json({ success: false, message: 'Action must be "accept" or "decline".' });
  }

  const invite = await prisma.boardInvite.findUnique({
    where: { id: inviteId },
    include: { board: true },
  });

  if (!invite || invite.inviteeId !== userId) {
    return res.status(404).json({ success: false, message: 'Invite not found.' });
  }

  if (invite.status !== 'PENDING') {
    return res.status(400).json({
      success: false,
      message: `This invite was already ${invite.status.toLowerCase()}.`,
    });
  }

  if (action === 'decline') {
    await prisma.boardInvite.update({
      where: { id: inviteId },
      data: { status: 'DECLINED' },
    });
    return res.json({ success: true, message: 'Invite declined.' });
  }

  // Accept: add user as member and mark invite accepted (in a transaction)
  await prisma.$transaction([
    prisma.whiteboardMember.upsert({
      where: { boardId_userId: { boardId: invite.boardId, userId } },
      create: { boardId: invite.boardId, userId, role: invite.role },
      update: { role: invite.role },
    }),
    prisma.boardInvite.update({
      where: { id: inviteId },
      data: { status: 'ACCEPTED' },
    }),
  ]);

  return res.json({
    success: true,
    message: `You joined "${invite.board.title}" as ${invite.role.toLowerCase()}!`,
    data: { boardId: invite.boardId },
  });
}

/**
 * Remove a collaborator from a whiteboard
 * DELETE /api/whiteboards/:id/members/:memberId
 */
export async function removeBoardMember(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id, memberId } = req.params;

  const board = await prisma.whiteboard.findUnique({
    where: { id },
  });

  if (!board) {
    return res.status(404).json({ success: false, message: 'Whiteboard not found.' });
  }

  // Only board owner can remove collaborators (or a member can remove themselves)
  const member = await prisma.whiteboardMember.findUnique({
    where: { id: memberId },
  });

  if (!member || member.boardId !== id) {
    return res.status(404).json({ success: false, message: 'Collaborator not found on this board.' });
  }

  const isOwner = board.ownerId === userId;
  const isSelf = member.userId === userId;

  if (!isOwner && !isSelf) {
    return res.status(403).json({
      success: false,
      message: 'Only the board owner can remove collaborators.',
    });
  }

  await prisma.whiteboardMember.delete({
    where: { id: memberId },
  });

  return res.json({
    success: true,
    message: 'Collaborator removed successfully.',
  });
}

/**
 * Update the link-access level for a whiteboard
 * PATCH /api/whiteboards/:id/link-access
 * Body: { linkAccess: 'NONE' | 'VIEWER' | 'EDITOR' }
 */
export async function updateLinkAccess(req: Request, res: Response) {
  const userId = req.user!.id;
  const { id } = req.params;
  const { linkAccess } = req.body;

  if (!['NONE', 'VIEWER', 'EDITOR'].includes(linkAccess)) {
    return res.status(400).json({
      success: false,
      message: 'linkAccess must be one of: NONE, VIEWER, EDITOR',
    });
  }

  const board = await prisma.whiteboard.findUnique({ where: { id } });

  if (!board) {
    return res.status(404).json({ success: false, message: 'Whiteboard not found.' });
  }

  if (board.ownerId !== userId) {
    return res.status(403).json({
      success: false,
      message: 'Only the board owner can change link access settings.',
    });
  }

  await prisma.whiteboard.update({
    where: { id },
    data: { linkAccess: linkAccess as any },
  });

  return res.json({
    success: true,
    message: `Link access updated to ${linkAccess}.`,
    data: { linkAccess },
  });
}
