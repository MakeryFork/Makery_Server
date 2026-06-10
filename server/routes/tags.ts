import { Router } from "express";
import { prisma } from "../lib/prisma";

const router = Router();

// GET /tags
router.get("/", async (_req, res) => {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
    return res.json({ success: true, data: tags });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "서버 오류" });
  }
});

export default router;
