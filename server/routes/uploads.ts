import { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { auth } from '../middleware/auth';

const router = Router();

const storage = multer.diskStorage({
  destination: path.join(process.cwd(), 'uploads'),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowed = /^(image|video)\//;
  if (allowed.test(file.mimetype)) cb(null, true);
  else cb(new Error('이미지 또는 영상 파일만 업로드할 수 있습니다.'));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 500 * 1024 * 1024 },
});

function fileUrl(req: Request, filename: string) {
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

// POST /uploads — 단일 파일
router.post('/', auth, upload.single('file'), (req: Request, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'No file uploaded' });
    return;
  }
  res.json({ success: true, data: { url: fileUrl(req, req.file.filename) } });
});

// POST /uploads/batch — 여러 파일 (최대 20개)
router.post('/batch', auth, upload.array('files', 20), (req: Request, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files?.length) {
    res.status(400).json({ success: false, message: 'No files uploaded' });
    return;
  }
  const urls = files.map((f) => ({
    url: fileUrl(req, f.filename),
    mimetype: f.mimetype,
    originalName: f.originalname,
  }));
  res.json({ success: true, data: { urls } });
});

export default router;
