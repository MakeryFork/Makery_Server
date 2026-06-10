import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { auth } from '../middleware/auth';
import { AppError } from '../middleware/error.middleware';
import { VideoEditData } from '../types';

const router = Router();

// GET /video-projects
router.get('/', auth, async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const [items, total] = await Promise.all([
      prisma.videoProject.findMany({
        where: { userId: req.user!.id },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, thumbnailUrl: true, duration: true, updatedAt: true },
      }),
      prisma.videoProject.count({ where: { userId: req.user!.id } }),
    ]);

    return res.json({ success: true, data: { items, total, page, limit } });
  } catch (err) {
    next(err);
  }
});

// GET /video-projects/:id
router.get('/:id', auth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const project = await prisma.videoProject.findUnique({ where: { id } });
    if (!project) throw new AppError(404, '프로젝트를 찾을 수 없습니다.');
    if (project.userId !== req.user!.id) throw new AppError(403, '권한이 없습니다.');
    return res.json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
});

// POST /video-projects
router.post('/', auth, async (req, res, next) => {
  try {
    const { title, thumbnailUrl, duration, editData } = req.body as {
      title: string;
      thumbnailUrl?: string;
      duration?: number;
      editData: VideoEditData;
    };

    const project = await prisma.videoProject.create({
      data: { userId: req.user!.id, title, thumbnailUrl, duration, editData: editData as object },
    });

    return res.status(201).json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
});

// PATCH /video-projects/:id
router.patch('/:id', auth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.videoProject.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, '프로젝트를 찾을 수 없습니다.');
    if (existing.userId !== req.user!.id) throw new AppError(403, '권한이 없습니다.');

    const { title, thumbnailUrl, duration, editData } = req.body as {
      title?: string;
      thumbnailUrl?: string;
      duration?: number;
      editData?: VideoEditData;
    };

    const project = await prisma.videoProject.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl }),
        ...(duration !== undefined && { duration }),
        ...(editData !== undefined && { editData: editData as object }),
      },
    });

    return res.json({ success: true, data: project });
  } catch (err) {
    next(err);
  }
});

// DELETE /video-projects/:id
router.delete('/:id', auth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.videoProject.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, '프로젝트를 찾을 수 없습니다.');
    if (existing.userId !== req.user!.id) throw new AppError(403, '권한이 없습니다.');

    await prisma.videoProject.delete({ where: { id } });
    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /video-projects/:id/export
router.post('/:id/export', auth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { videoUrl } = req.body as { videoUrl: string };

    const existing = await prisma.videoProject.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, '프로젝트를 찾을 수 없습니다.');
    if (existing.userId !== req.user!.id) throw new AppError(403, '권한이 없습니다.');

    const updated = await prisma.videoProject.update({
      where: { id },
      data: { exportedVideoUrl: videoUrl },
      select: { id: true, exportedVideoUrl: true },
    });

    return res.json({ success: true, data: { downloadUrl: updated.exportedVideoUrl } });
  } catch (err) {
    next(err);
  }
});

export default router;
