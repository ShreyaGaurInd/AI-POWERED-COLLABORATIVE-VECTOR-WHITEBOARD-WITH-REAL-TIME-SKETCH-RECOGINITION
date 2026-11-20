import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';

// ── GET /api/friends ──────────────────────────────────────────────────────────
// Returns accepted friends, pending incoming requests, and pending outgoing requests
export async function getFriends(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    // Fetch all friendships involving current user
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: {
          select: { id: true, fullName: true, email: true, avatarColor: true },
        },
        receiver: {
          select: { id: true, fullName: true, email: true, avatarColor: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const acceptedFriends: Array<{
      friendshipId: string;
      id: string;
      fullName: string;
      email: string;
      avatarColor: string;
      since: Date;
    }> = [];

    const incomingRequests: Array<{
      friendshipId: string;
      sender: { id: string; fullName: string; email: string; avatarColor: string };
      createdAt: Date;
    }> = [];

    const outgoingRequests: Array<{
      friendshipId: string;
      receiver: { id: string; fullName: string; email: string; avatarColor: string };
      createdAt: Date;
    }> = [];

    for (const f of friendships) {
      if (f.status === 'ACCEPTED') {
        const friendUser = f.senderId === userId ? f.receiver : f.sender;
        acceptedFriends.push({
          friendshipId: f.id,
          id: friendUser.id,
          fullName: friendUser.fullName,
          email: friendUser.email,
          avatarColor: friendUser.avatarColor,
          since: f.updatedAt,
        });
      } else if (f.status === 'PENDING') {
        if (f.receiverId === userId) {
          incomingRequests.push({
            friendshipId: f.id,
            sender: f.sender,
            createdAt: f.createdAt,
          });
        } else {
          outgoingRequests.push({
            friendshipId: f.id,
            receiver: f.receiver,
            createdAt: f.createdAt,
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        friends: acceptedFriends,
        incomingRequests,
        outgoingRequests,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/friends/search?q=query ──────────────────────────────────────────
// Search registered users by name or email (excludes self)
export async function searchUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const query = String(req.query.q || '').trim();

    if (!query || query.length < 2) {
      res.json({ success: true, data: { users: [] } });
      return;
    }

    // Find users matching email or name (up to 10)
    const matches = await prisma.user.findMany({
      where: {
        AND: [
          { id: { not: userId } },
          {
            OR: [
              { email: { contains: query } },
              { fullName: { contains: query } },
            ],
          },
        ],
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarColor: true,
      },
      take: 10,
    });

    // Check relationship status for each match
    const usersWithStatus = await Promise.all(
      matches.map(async (u) => {
        const rel = await prisma.friendship.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: u.id },
              { senderId: u.id, receiverId: userId },
            ],
          },
        });

        let friendshipStatus: 'NONE' | 'FRIENDS' | 'SENT' | 'RECEIVED' = 'NONE';
        if (rel) {
          if (rel.status === 'ACCEPTED') friendshipStatus = 'FRIENDS';
          else if (rel.senderId === userId) friendshipStatus = 'SENT';
          else friendshipStatus = 'RECEIVED';
        }

        return {
          ...u,
          friendshipStatus,
          friendshipId: rel?.id,
        };
      })
    );

    res.json({
      success: true,
      data: { users: usersWithStatus },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/friends/request ────────────────────────────────────────────────
// Send a friend request by receiverId or email
export async function sendFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const senderId = req.user!.id;
    const { receiverId, email } = req.body;

    let targetUserId = receiverId;

    if (!targetUserId && email) {
      const found = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
        select: { id: true },
      });
      if (!found) {
        res.status(404).json({ success: false, message: 'User with this email not found.' });
        return;
      }
      targetUserId = found.id;
    }

    if (!targetUserId) {
      res.status(400).json({ success: false, message: 'Receiver ID or email is required.' });
      return;
    }

    if (targetUserId === senderId) {
      res.status(400).json({ success: false, message: 'You cannot add yourself as a friend.' });
      return;
    }

    // Check if relationship already exists
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: senderId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        res.status(400).json({ success: false, message: 'You are already friends.' });
        return;
      }
      if (existing.status === 'PENDING') {
        if (existing.senderId === senderId) {
          res.status(400).json({ success: false, message: 'Friend request already sent.' });
          return;
        } else {
          // Auto-accept if they had sent a request to you
          const accepted = await prisma.friendship.update({
            where: { id: existing.id },
            data: { status: 'ACCEPTED' },
          });
          res.json({ success: true, message: 'Friend request accepted!', data: accepted });
          return;
        }
      }
    }

    const created = await prisma.friendship.create({
      data: {
        senderId,
        receiverId: targetUserId,
        status: 'PENDING',
      },
      include: {
        receiver: {
          select: { id: true, fullName: true, email: true, avatarColor: true },
        },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Friend request sent successfully.',
      data: created,
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/friends/accept ─────────────────────────────────────────────────
export async function acceptFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { friendshipId } = req.body;

    if (!friendshipId) {
      res.status(400).json({ success: false, message: 'friendshipId is required.' });
      return;
    }

    const request = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!request || request.receiverId !== userId) {
      res.status(404).json({ success: false, message: 'Friend request not found or unauthorized.' });
      return;
    }

    const updated = await prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
      include: {
        sender: {
          select: { id: true, fullName: true, email: true, avatarColor: true },
        },
      },
    });

    res.json({
      success: true,
      message: 'Friend request accepted.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/friends/reject ─────────────────────────────────────────────────
export async function rejectFriendRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { friendshipId } = req.body;

    if (!friendshipId) {
      res.status(400).json({ success: false, message: 'friendshipId is required.' });
      return;
    }

    const request = await prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!request || (request.receiverId !== userId && request.senderId !== userId)) {
      res.status(404).json({ success: false, message: 'Friend request not found or unauthorized.' });
      return;
    }

    await prisma.friendship.delete({
      where: { id: friendshipId },
    });

    res.json({
      success: true,
      message: 'Friend request cancelled/rejected.',
    });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/friends/:friendId ────────────────────────────────────────────
export async function removeFriend(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { friendId } = req.params;

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      },
    });

    if (!friendship) {
      res.status(404).json({ success: false, message: 'Friendship not found.' });
      return;
    }

    await prisma.friendship.delete({
      where: { id: friendship.id },
    });

    res.json({
      success: true,
      message: 'Friend removed successfully.',
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/friends/:friendId/messages ──────────────────────────────────────
export async function getDirectMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const { friendId } = req.params;

    const messages = await prisma.directMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: friendId },
          { senderId: friendId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    res.json({
      success: true,
      data: { messages },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/friends/:friendId/messages ─────────────────────────────────────
export async function sendDirectMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const senderId = req.user!.id;
    const { friendId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      res.status(400).json({ success: false, message: 'Message content is required.' });
      return;
    }

    const created = await prisma.directMessage.create({
      data: {
        senderId,
        receiverId: friendId,
        message: message.trim(),
      },
    });

    res.status(201).json({
      success: true,
      data: created,
    });
  } catch (err) {
    next(err);
  }
}
