import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { IUser, User } from "../models/User";

export interface AuthRequest extends Request {
  user?: any;
}

// میدل‌ور اصلی احراز هویت
export const auth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token =
      req.cookies?.token || req.header("Authorization")?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ message: "لطفا وارد شوید" });

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as any;
    console.log(decoded);
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) return res.status(401).json({ message: "کاربر یافت نشد" });

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "توکن نامعتبر" });
  }
};

// میدل‌ور بررسی مالکیت
export const checkOwnership = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || !req.user._id.equals(req.params.userId)) {
    return res.status(403).json({
      success: false,
      message: "شما فقط به اطلاعات خود دسترسی دارید",
    });
  }

  next();
};
