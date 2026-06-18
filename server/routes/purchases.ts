import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { prisma } from '../lib/prisma';
import { auth } from '../middleware/auth';
import { AppError } from '../middleware/error.middleware';
import { env } from '../config/env';
import { TossPaymentResponse, VideoEditData } from '../types';

const router = Router();

// POST /purchases — 결제 시작 (Toss 위젯용 orderId 발급)
router.post('/', auth, async (req, res, next) => {
  try {
    const { postId } = req.body as { postId: number };
    const buyerId = req.user!.id;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new AppError(404, '게시물을 찾을 수 없습니다.');
    if (post.authorId === buyerId) throw new AppError(400, '본인 게시물은 구매할 수 없습니다.');

    const existing = await prisma.purchase.findUnique({
      where: { buyerId_postId: { buyerId, postId } },
    });
    if (existing?.paymentStatus === 'DONE') throw new AppError(400, '이미 구매한 게시물입니다.');

    const orderId = `ORDER_${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 20)}`;

    const purchase = existing
      ? await prisma.purchase.update({ where: { id: existing.id }, data: { orderId, paymentStatus: 'PENDING' } })
      : await prisma.purchase.create({ data: { buyerId, postId, price: post.price, orderId, paymentStatus: 'PENDING' } });

    return res.status(201).json({
      success: true,
      data: { orderId: purchase.orderId, amount: purchase.price, postTitle: post.title },
    });
  } catch (err) {
    next(err);
  }
});

// POST /purchases/confirm — Toss 결제 최종 승인
router.post('/confirm', auth, async (req, res, next) => {
  try {
    const { paymentKey, orderId, amount } = req.body as {
      paymentKey: string;
      orderId: string;
      amount: number;
    };

    const purchase = await prisma.purchase.findUnique({ where: { orderId } });
    if (!purchase) throw new AppError(404, '주문을 찾을 수 없습니다.');
    if (purchase.price !== amount) throw new AppError(400, '결제 금액이 일치하지 않습니다.');
    if (purchase.paymentStatus === 'DONE') throw new AppError(400, '이미 완료된 결제입니다.');

    const encodedKey = Buffer.from(`${env.toss.secretKey}:`).toString('base64');

    let tossData: TossPaymentResponse;
    try {
      const tossRes = await axios.post<TossPaymentResponse>(
        'https://api.tosspayments.com/v1/payments/confirm',
        { paymentKey, orderId, amount },
        { headers: { Authorization: `Basic ${encodedKey}`, 'Content-Type': 'application/json' } },
      );
      tossData = tossRes.data;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        throw new AppError(err.response.status, err.response.data?.message || '결제 승인에 실패했습니다.');
      }
      throw new AppError(502, '결제 서버와 통신에 실패했습니다.');
    }

    const updated = await prisma.purchase.update({
      where: { orderId },
      data: {
        paymentKey,
        paymentMethod: tossData.method,
        paymentStatus: tossData.status === 'DONE' ? 'DONE' : 'ABORTED',
        purchasedAt: tossData.status === 'DONE' ? new Date() : null,
      },
      include: { post: { select: { id: true, title: true, thumbnailUrl: true } } },
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /purchases/direct — 무료 게시물 즉시 구매
router.post('/direct', auth, async (req, res, next) => {
  try {
    const { postId } = req.body as { postId: number };
    const buyerId = req.user!.id;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) throw new AppError(404, '게시물을 찾을 수 없습니다.');
    if (post.price > 0) throw new AppError(400, '유료 게시물은 결제가 필요합니다.');

    const existing = await prisma.purchase.findUnique({
      where: { buyerId_postId: { buyerId, postId } },
    });
    if (existing?.paymentStatus === 'DONE') throw new AppError(400, '이미 구매한 게시물입니다.');

    const orderId = `ORDER_${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 20)}`;
    const now = new Date();

    const purchase = existing
      ? await prisma.purchase.update({
          where: { id: existing.id },
          data: { orderId, paymentStatus: 'DONE', purchasedAt: now },
          include: { post: { select: { id: true, title: true, thumbnailUrl: true } } },
        })
      : await prisma.purchase.create({
          data: { buyerId, postId, price: 0, orderId, paymentStatus: 'DONE', purchasedAt: now },
          include: { post: { select: { id: true, title: true, thumbnailUrl: true } } },
        });

    return res.status(201).json({ success: true, data: purchase });
  } catch (err) {
    next(err);
  }
});

// GET /purchases/me — 내 구매 목록
router.get('/me', auth, async (req, res, next) => {
  try {
    const buyerId = req.user!.id;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const [items, total] = await Promise.all([
      prisma.purchase.findMany({
        where: { buyerId, paymentStatus: 'DONE' },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { purchasedAt: 'desc' },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              description: true,
              thumbnailUrl: true,
              price: true,
              videoProjectId: true,
              viewCount: true,
              createdAt: true,
              updatedAt: true,
              author: {
                select: {
                  id: true,
                  name: true,
                  profileImageUrl: true,
                  socialAccounts: { select: { provider: true } },
                },
              },
              postDetails: { orderBy: { sortOrder: 'asc' }, select: { id: true, sortOrder: true, content: true } },
              postTags: { select: { tag: { select: { id: true, name: true } } } },
              _count: { select: { purchases: true } },
            },
          },
        },
      }),
      prisma.purchase.count({ where: { buyerId, paymentStatus: 'DONE' } }),
    ]);

    return res.json({ success: true, data: { items, total, page, limit } });
  } catch (err) {
    next(err);
  }
});

// GET /purchases/:postId/sources — 구매한 템플릿 소스 조회
router.get('/:postId/sources', auth, async (req, res, next) => {
  try {
    const postId = Number(req.params.postId);
    const buyerId = req.user!.id;

    const purchase = await prisma.purchase.findUnique({
      where: { buyerId_postId: { buyerId, postId } },
    });
    if (!purchase || purchase.paymentStatus !== 'DONE')
      throw new AppError(403, '구매 내역이 없습니다.');

    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { title: true, thumbnailUrl: true, videoProjectId: true },
    });
    if (!post?.videoProjectId) throw new AppError(404, '비디오 프로젝트가 없습니다.');

    const project = await prisma.videoProject.findUnique({
      where: { id: post.videoProjectId },
      select: { editData: true },
    });

    const ed = ((project?.editData ?? {}) as unknown) as VideoEditData;
    const templateSources = {
      effects:    ed.effects    ?? [],
      texts:      ed.texts      ?? [],
      audios:     ed.audios     ?? [],
      animations: ed.animations ?? [],
      splits:     ed.splits     ?? [],
    };

    return res.json({
      success: true,
      data: {
        postId,
        videoProjectId: post.videoProjectId,
        post: { title: post.title, thumbnailUrl: post.thumbnailUrl },
        clipSlots: [],
        templateSources,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
