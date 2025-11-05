import { Router } from "express";
import { userController } from "../controllers/userController";
import { auth, checkOwnership } from "../middleware/auth";
import {
  validateRegister,
  validateTransaction,
} from "../middleware/validation";
import { User } from "../models/User";

const router = Router();
router.get("/test-db", async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ success: true, totalUsers: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});
router.get("/all-users", userController.getAllUsers);
router.post("/check-email", userController.axitUser);
// 🔓 Public routes
router.post("/register", validateRegister, userController.register);
router.post("/login", userController.login);

// 🔐 Private routes under /me
router.get("/me/profile", auth, userController.getProfile);
router.put("/me/profile", auth, userController.updateProfile);
router.get("/me/portfolio", auth, userController.getPortfolio);
router.get("/me/transactions", auth, userController.getTransactions);
router.get("/me/analytics", auth, userController.getAnalytics);
router.post("/me/buy", auth, validateTransaction, userController.buyCrypto);
router.post("/me/sell", auth, validateTransaction, userController.sellCrypto);
router.post("/coin/like", auth,userController.toggleLikeCoin);
router.post("/coin/bookmark", auth, userController.toggleBookmarkCoin);
// 🌐 Market routes
router.get("/markets", auth, userController.getAllMarkets);
router.get("/markets/:coin", auth, userController.getCurrencyInfo);

// 🎯 Admin / Ownership protected routes
router.get(
  "/users/:userId/portfolio",
  auth,
  checkOwnership,
  userController.getPortfolio
);
router.get(
  "/users/:userId/transactions",
  auth,
  checkOwnership,
  userController.getTransactions
);

export default router;
