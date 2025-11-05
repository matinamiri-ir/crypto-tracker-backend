// src/routes/comments.ts
import express, { Request, Response } from "express";
import mongoose, { Types, Document } from "mongoose";
import { Comment, IComment } from "../models/Comment"; // مطمئن شو فایل Comments.ts در src/models/ هست

const router = express.Router();

// تایپ برای query parameters
interface CommentQuery {
  symbol?: string;
  coinId?: string;
  page?: string;
  limit?: string;
  sort?: string;
}
export function calculateRating(likes: number, dislikes: number): number {
  const total = likes + dislikes;
  if (total === 0) return 0;
  return Math.round((likes / total) * 5); // 0 تا 5 ستاره
}
// ======================= GET /api/comments =======================
router.get(
  "/",
  async (req: Request<{}, {}, {}, CommentQuery>, res: Response) => {
    try {
      const { symbol, page = "1", limit = "20", sort = "newest" } = req.query;
      const pageNum = Math.max(1, parseInt(page, 10));
      const lim = Math.min(100, parseInt(limit, 10) || 20);

      const filter: any = { hidden: { $ne: true } };
      if (symbol) filter.symbol = symbol;

      const sortObj: { [key: string]: 1 | -1 } =
        sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };

      const comments = await Comment.find(filter)
        .sort(sortObj)
        .skip((pageNum - 1) * lim)
        .limit(lim)
        .lean();

      const mapped = comments.map((c: any) => ({
        ...c,
        likes: c.likes?.length || 0,
        dislikes: c.dislikes?.length || 0,
      }));

      res.json({ page: pageNum, limit: lim, data: mapped });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err });
    }
  }
);

// ======================= POST /api/comments =======================
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, text, symbol, username } = req.body;
    if (!userId || !text)
      return res.status(400).json({ error: "userId and text required" });

    const comment = new Comment({
      userId,
      text,
      symbol,
      username,
      likes: [],
      dislikes: [],
    });

    await comment.save();
    res.status(201).json(comment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err });
  }
});

// ======================= POST /api/comments/:id/like =======================
router.post("/:commentId/like", async (req: Request, res: Response) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;

    // اعتبارسنجی
    if (!mongoose.isValidObjectId(commentId)) {
      return res.status(400).json({ message: "شناسه کامنت معتبر نیست" });
    }

    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "شناسه کاربر معتبر نیست" });
    }

    // پیدا کردن کامنت
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ message: "کامنت یافت نشد" });
    }

    const uid = new mongoose.Types.ObjectId(userId);

    // اگر قبلاً لایک کرده، حذفش کن (آن‌لایک)
    if (comment.likes.some((x: Types.ObjectId) => x.equals(uid))) {
      comment.likes = comment.likes.filter((x: Types.ObjectId) => !x.equals(uid));
    } else {
      // لایک کن و مطمئن شو دیسلایک حذف میشه
      comment.likes.push(uid);
      comment.dislikes = comment.dislikes.filter((x: Types.ObjectId) => !x.equals(uid));
    }

    // محاسبه لایک، دیسلایک و ریتینگ
    const likesCount = comment.likes.length;
    const dislikesCount = comment.dislikes.length;
    const total = likesCount + dislikesCount;
    const rating = total === 0 ? 0 : Math.round((likesCount / total) * 5);

    await comment.save();

    res.json({
      likes: likesCount,
      dislikes: dislikesCount,
      rating,
      message: "وضعیت لایک با موفقیت به‌روزرسانی شد",
    });
  } catch (err) {
    console.error("❌ خطا در لایک کامنت:", err);
    res.status(500).json({ message: "خطای سرور در لایک کامنت" });
  }
});

// ======================= POST /api/comments/:id/dislike =======================
router.post("/:id/dislike", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!mongoose.isValidObjectId(id))
      return res.status(400).json({ error: "invalid id" });

    const comment = await Comment.findById(id);
    if (!comment) return res.status(404).json({ error: "not found" });

    const uid = new mongoose.Types.ObjectId(userId);

    if (comment.dislikes.some((x: Types.ObjectId) => x.equals(uid))) {
      comment.dislikes = comment.dislikes.filter(
        (x: Types.ObjectId) => !x.equals(uid)
      );
    } else {
      comment.dislikes.push(uid);
      comment.likes = comment.likes.filter(
        (x: Types.ObjectId) => !x.equals(uid)
      );
    }
    const likesCount = comment.likes.length;
    const dislikesCount = comment.dislikes.length;
    const rating = calculateRating(likesCount, dislikesCount);

    await comment.save();
    res.json({ likes: likesCount, dislikes: dislikesCount, rating });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err });
  }
});

// ======================= DELETE /api/comments/:id =======================
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await Comment.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err });
  }
});

export default router;
