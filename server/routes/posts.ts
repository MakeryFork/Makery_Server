import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { auth, optionalAuth } from '../middleware/auth';
import { AppError } from '../middleware/error.middleware';
import { Provider } from '@prisma/client';
import { BuyerContent } from '../types';

const router = Router();

const POST_LIST_SELECT = {
  id: true,
  title: true,
  thumbnailUrl: true,
  price: true,
  viewCount: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      name: true,
      profileImageUrl: true,
      socialAccounts: { select: { provider: true } },
    },
  },
  postTags: { select: { tag: { select: { id: true, name: true } } } },
  _count: { select: { purchases: true } },
} as const;

// GET /posts
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { q, provider, tagId, minPrice, maxPrice, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (Number(page) - 1) * Number(limit);

    const where: Record<string, unknown> = {};
    if (q) where.title = { contains: q, mode: 'insensitive' };
    if (provider && Object.values(Provider).includes(provider as Provider)) {
      where.author = { socialAccounts: { some: { provider: provider as Provider } } };
    }
    if (tagId) where.postTags = { some: { tagId: Number(tagId) } };
    if (minPrice || maxPrice) {
      where.price = {
        ...(minPrice ? { gte: Number(minPrice) } : {}),
        ...(maxPrice ? { lte: Number(maxPrice) } : {}),
      };
    }

    const [total, posts] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({ where, skip, take: Number(limit), orderBy: { updatedAt: 'desc' }, select: POST_LIST_SELECT }),
    ]);

    return res.json({ success: true, data: posts, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
});

// GET /posts/:id
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        price: true,
        viewCount: true,
        videoProjectId: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            name: true,
            profileImageUrl: true,
            bio: true,
            socialAccounts: { select: { provider: true } },
          },
        },
        postDetails: { orderBy: { sortOrder: 'asc' }, select: { id: true, sortOrder: true, content: true } },
        postTags: { select: { tag: { select: { id: true, name: true } } } },
        _count: { select: { purchases: true } },
      },
    });

    if (!post) throw new AppError(404, '게시물을 찾을 수 없습니다.');

    await prisma.post.update({ where: { id }, data: { viewCount: { increment: 1 } } });

    return res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
});

// POST /posts
router.post('/', auth, async (req, res, next) => {
  try {
    const { title, description, thumbnailUrl, price, details, tagIds, buyerContent, videoProjectId } = req.body as {
      title: string;
      description: string;
      thumbnailUrl?: string;
      price: number;
      details?: { sortOrder: number; content: string }[];
      tagIds?: number[];
      buyerContent?: BuyerContent;
      videoProjectId?: number;
    };

    const post = await prisma.post.create({
      data: {
        title,
        description,
        thumbnailUrl,
        price,
        ...(buyerContent !== undefined && { buyerContent: buyerContent as object }),
        authorId: req.user!.id,
        ...(videoProjectId && { videoProjectId }),
        postDetails: {
          create: (details ?? []).map((d) => ({ sortOrder: d.sortOrder, content: d.content })),
        },
        postTags: {
          create: (tagIds ?? []).map((tagId) => ({ tagId })),
        },
      },
      include: {
        postDetails: { orderBy: { sortOrder: 'asc' } },
        postTags: { select: { tag: { select: { id: true, name: true } } } },
      },
    });

    return res.status(201).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
});

// PATCH /posts/:id
router.patch('/:id', auth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, '게시물을 찾을 수 없습니다.');
    if (existing.authorId !== req.user!.id) throw new AppError(403, '권한이 없습니다.');

    const { title, description, thumbnailUrl, price, details, tagIds, buyerContent } = req.body as {
      title?: string;
      description?: string;
      thumbnailUrl?: string;
      price?: number;
      details?: { sortOrder: number; content: string }[];
      tagIds?: number[];
      buyerContent?: BuyerContent;
    };

    const post = await prisma.post.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(price !== undefined && { price }),
        ...(buyerContent !== undefined && { buyerContent: buyerContent as object }),
        ...(details !== undefined && {
          postDetails: {
            deleteMany: {},
            create: details.map((d) => ({ sortOrder: d.sortOrder, content: d.content })),
          },
        }),
        ...(tagIds !== undefined && {
          postTags: {
            deleteMany: {},
            create: tagIds.map((tagId) => ({ tagId })),
          },
        }),
      },
      include: {
        postDetails: { orderBy: { sortOrder: 'asc' } },
        postTags: { select: { tag: { select: { id: true, name: true } } } },
      },
    });

    return res.json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
});

// DELETE /posts/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.post.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, '게시물을 찾을 수 없습니다.');
    if (existing.authorId !== req.user!.id) throw new AppError(403, '권한이 없습니다.');

    await prisma.post.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// GET /posts/:id/buyer-content
router.get('/:id/buyer-content', auth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user!.id;

    const post = await prisma.post.findUnique({ where: { id } });
    if (!post) throw new AppError(404, '게시물을 찾을 수 없습니다.');

    if (post.authorId !== userId) {
      const purchase = await prisma.purchase.findUnique({
        where: { buyerId_postId: { buyerId: userId, postId: id } },
      });
      if (!purchase || purchase.paymentStatus !== 'DONE') {
        throw new AppError(403, '구매 후 접근 가능합니다.');
      }
    }

    return res.json({ success: true, data: { buyerContent: post.buyerContent } });
  } catch (err) {
    next(err);
  }
});

export default router;
