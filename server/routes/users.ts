import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { auth } from '../middleware/auth';
import { AppError } from '../middleware/error.middleware';

const router = Router();

// GET /users/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        socialAccounts: { select: { provider: true } },
        _count: { select: { posts: true, followers: true, following: true } },
      },
    });
    if (!user) throw new AppError(404, '유저를 찾을 수 없습니다.');

    return res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        bio: user.bio,
        profileImageUrl: user.profileImageUrl,
        socialAccounts: user.socialAccounts.map((s) => s.provider),
        _count: user._count,
      },
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /users/me
router.patch('/me', auth, async (req, res, next) => {
  try {
    const { name, bio, profileImageUrl } = req.body as { name?: string; bio?: string; profileImageUrl?: string };
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name, bio, profileImageUrl },
      include: { socialAccounts: { select: { provider: true } } },
    });
    return res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
});

// POST /users/:id/follow
router.post('/:id/follow', auth, async (req, res, next) => {
  try {
    const followingId = Number(req.params.id);
    const followerId = req.user!.id;
    if (followerId === followingId) throw new AppError(400, '자기 자신을 팔로우할 수 없습니다.');

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    });
    if (existing) throw new AppError(400, '이미 팔로우 중입니다.');

    await prisma.follow.create({ data: { followerId, followingId } });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /users/:id/follow
router.delete('/:id/follow', auth, async (req, res, next) => {
  try {
    const followingId = Number(req.params.id);
    const followerId = req.user!.id;

    await prisma.follow.delete({ where: { followerId_followingId: { followerId, followingId } } });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /users/:id/followers
router.get('/:id/followers', async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const [total, follows] = await Promise.all([
      prisma.follow.count({ where: { followingId: userId } }),
      prisma.follow.findMany({
        where: { followingId: userId },
        skip: (page - 1) * limit,
        take: limit,
        include: { follower: { select: { id: true, name: true, profileImageUrl: true } } },
      }),
    ]);

    return res.json({ success: true, data: follows.map((f) => f.follower), total, page, limit });
  } catch (err) {
    next(err);
  }
});

// GET /users/:id/following
router.get('/:id/following', async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const [total, follows] = await Promise.all([
      prisma.follow.count({ where: { followerId: userId } }),
      prisma.follow.findMany({
        where: { followerId: userId },
        skip: (page - 1) * limit,
        take: limit,
        include: { following: { select: { id: true, name: true, profileImageUrl: true } } },
      }),
    ]);

    return res.json({ success: true, data: follows.map((f) => f.following), total, page, limit });
  } catch (err) {
    next(err);
  }
});

// GET /users/:id/posts
router.get('/:id/posts', async (req, res, next) => {
  try {
    const authorId = Number(req.params.id);
    const posts = await prisma.post.findMany({
      where: { authorId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        thumbnailUrl: true,
        price: true,
        viewCount: true,
        updatedAt: true,
        postTags: { select: { tag: { select: { id: true, name: true } } } },
        _count: { select: { purchases: true } },
      },
    });
    return res.json({ success: true, data: posts });
  } catch (err) {
    next(err);
  }
});

export default router;
