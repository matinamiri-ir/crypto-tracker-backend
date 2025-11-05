import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, IUser, ITransaction, IAsset } from "../models/User";
import { AuthRequest } from "../middleware/auth";
import { customApiService, MarketPriceInfo } from "../services/customAPI";
import { z } from "zod";
import NodeCache from "node-cache";
import mongoose from "mongoose";

// Cache configuration
const priceCache = new NodeCache({ stdTTL: 10 });

// JWT Secret validation
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET is required in production environment");
}

// Zod Schemas
const registerSchema = z.object({
  username: z.string().min(3).max(30).optional(),
  email: z.string().email(),
  password: z.string().min(6),
  initialBalance: z.number().min(0).max(1_000_000).optional().default(10000),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const transactionSchema = z.object({
  coin: z.string().min(1).max(10),
  amount: z.number().positive().max(1_000_000),
  price: z.number().positive().max(1_000_000_000),
});

const paginationSchema = z.object({
  page: z.preprocess((val) => Number(val ?? 1), z.number().min(1)),
  limit: z.preprocess((val) => Number(val ?? 10), z.number().min(1).max(100)),
  type: z.enum(["buy", "sell"]).optional(),
  coin: z.string().optional(),
});
const updateProfileSchema = z.object({
  username: z.string().min(3).max(30).optional(),
});

// Interfaces
interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

interface PortfolioData {
  totalValue: number;
  cashBalance: number;
  assetsValue: number;
  assets: UserAssetWithPrice[];
  profitLoss: number;
  profitLossPercentage: number;
  currency: string;
  performance: {
    totalTransactions: number;
    totalTrades: number;
    successRate: string;
  };
}

interface UserAssetWithPrice extends IAsset {
  marketInfo: MarketPriceInfo | null;
  valueInToman: number;
  valueInDollar: number;
  change24h: number;
  totalChange: number;
}

// Utility Functions
const formatCurrency = (value: number): number => Math.round(value * 100) / 100;

const handleValidationError = (error: z.ZodError): string => {
  return error.issues[0]?.message || "داده‌های ورودی نامعتبر است";
};

const executeWithTransaction = async (
  operation: (session: mongoose.ClientSession) => Promise<void>
): Promise<void> => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    await operation(session);
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};

const calculateSuccessRate = (transactions: ITransaction[]): string => {
  if (!transactions.length) return "0%";

  const profitableTrades = transactions.filter((t) => {
    if (t.type !== "sell") return false;

    const buyTransactions = transactions.filter(
      (b) => b.coin === t.coin && b.type === "buy" && b.date < t.date
    );

    if (!buyTransactions.length) return false;

    const avgBuyPrice =
      buyTransactions.reduce((sum, b) => sum + b.price, 0) /
      buyTransactions.length;
    return t.price > avgBuyPrice;
  }).length;

  return `${((profitableTrades / transactions.length) * 100).toFixed(2)}%`;
};

const getMostTradedCoin = (transactions: ITransaction[]): string => {
  const count: Record<string, number> = {};
  transactions.forEach((t) => {
    count[t.coin] = (count[t.coin] || 0) + 1;
  });
  return Object.keys(count).reduce(
    (a, b) => (count[a] > count[b] ? a : b),
    "N/A"
  );
};

const getMonthlyVolume = (transactions: ITransaction[]): number => {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  return transactions
    .filter((t) => {
      const transactionDate = new Date(t.date);
      return (
        transactionDate.getMonth() === currentMonth &&
        transactionDate.getFullYear() === currentYear
      );
    })
    .reduce((total, t) => total + t.amount * t.price, 0);
};

const calculateAverageTradeSize = (transactions: ITransaction[]): number => {
  if (!transactions.length) return 0;
  return (
    transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length
  );
};

// Main Controller
export const userController = {
  // 🔍 دریافت همه کاربران (فقط برای تست یا ادمین)
  async getAllUsers(req: Request, res: Response) {
    try {
      const users = await User.find({}, { password: 0 }); // پسورد رو ننداز
      console.log("Fetched users:", users); // 🔍 برای دیباگ
      res.json({ success: true, data: users });
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .json({ success: false, message: "خطا در دریافت کاربران" });
    }
  },

  async axitUser(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res
          .status(400)
          .json({ success: false, message: "ایمیل ارسال نشده" });
      }

      const user = await User.findOne({ email });

      if (user) {
        return res.json({
          success: true,
          exists: true,
          message: "کاربر قبلاً ثبت نام کرده",
        });
      } else {
        return res.json({
          success: true,
          exists: false,
          message: "ایمیل آزاد است",
        });
      }
    } catch (err) {
      console.error(err);
      return res
        .status(500)
        .json({ success: false, message: "خطا در بررسی ایمیل" });
    }
  },

  // 🔐 ثبت نام کاربر
  async register(req: Request, res: Response): Promise<void> {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: handleValidationError(parsed.error),
        });
        return;
      }

      const { username, email, password, initialBalance } = parsed.data;

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: "این ایمیل قبلاً ثبت شده است",
        });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const safeUsername = username || (email ? email.split("@")[0] : "user");

      const user = new User({
        username: safeUsername,
        email,
        password: hashedPassword,
        wallet: {
          balance: initialBalance,
          assets: [],
        },
        transactions: [],
        profile: {
          verified: false,
          joinDate: new Date(),
        },
      });

      await user.save();

      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
        },
        JWT_SECRET || "fallback-secret-only-for-dev",
        { expiresIn: "7d" }
      );

      res.status(201).json({
        success: true,
        message: "ثبت نام با موفقیت انجام شد",
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            wallet: user.wallet,
          },
          token,
        },
      });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({
        success: false,
        message: "خطا در ثبت نام",
      });
    }
  },

  // 🔑 لاگین کاربر
  async login(req: Request, res: Response): Promise<void> {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: handleValidationError(parsed.error),
        });
        return;
      }

      const { email, password } = parsed.data;

      const user = await User.findOne({ email });
      if (!user) {
        res.status(401).json({
          success: false,
          message: "ایمیل یا رمز عبور اشتباه است",
        });
        return;
      }

      const isValidPassword = await bcrypt.compare(
        password,
        user.password || ""
      );
      if (!isValidPassword) {
        res.status(401).json({
          success: false,
          message: "ایمیل یا رمز عبور اشتباه است",
        });
        return;
      }

      user.lastLogin = new Date();
      await user.save();

      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
        },
        JWT_SECRET || "fallback-secret-only-for-dev",
        { expiresIn: "7d" }
      );

      res.json({
        success: true,
        message: "لاگین موفق",
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            wallet: user.wallet,
            lastLogin: user.lastLogin,
          },
          token,
        },
      });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({
        success: false,
        message: "خطا در لاگین",
      });
    }
  },

  async buyCrypto(req: AuthRequest, res: Response): Promise<void> {
    try {
      const parsed = transactionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: handleValidationError(parsed.error),
        });
        return;
      }

      const { coin, amount, price } = parsed.data;
      const user = req.user;
      const normalizedCoin = coin.toUpperCase();
      const totalCost = amount * price;

      if (user.wallet.balance < totalCost) {
        res.status(400).json({
          success: false,
          message: "موجودی کافی نیست",
          data: { required: totalCost, current: user.wallet.balance },
        });
        return;
      }

      await executeWithTransaction(async (session) => {
        user.wallet.balance -= totalCost;
        const existingAsset = user.wallet.assets.find(
          (a: IAsset) => a.coin === normalizedCoin
        );
        if (existingAsset) existingAsset.amount += amount;
        else user.wallet.assets.push({ coin: normalizedCoin, amount });

        await user.addTransaction(
          {
            coin: normalizedCoin,
            amount,
            price,
            type: "buy",
            date: new Date(),
          },
          session
        );
        await user.save({ session });
      });

      priceCache.del(`portfolio_${user._id}`);

      res.json({
        success: true,
        message: `خرید ${amount} ${coin} با موفقیت انجام شد`,
        data: {
          newBalance: user.wallet.balance,
          updatedAssets: user.wallet.assets,
        },
      });
      return; // ⚡ بدون return res.json(...)
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "خطا در انجام خرید" });
    }
  },

  // 💸 فروش ارز
  async sellCrypto(req: AuthRequest, res: Response): Promise<void> {
    try {
      const parsed = transactionSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: handleValidationError(parsed.error),
        });
        return;
      }

      const { coin, amount, price } = parsed.data;
      const user = req.user;
      const normalizedCoin = coin.toUpperCase();

      const asset = user.wallet.assets.find(
        (a: IAsset) => a.coin === normalizedCoin
      );
      if (!asset || asset.amount < amount) {
        res.status(400).json({
          success: false,
          message: `موجودی ${coin} کافی نیست`,
          data: { available: asset?.amount || 0, requested: amount },
        });
        return;
      }

      await executeWithTransaction(async (session) => {
        asset.amount -= amount;
        user.wallet.balance += amount * price;
        if (asset.amount <= 0) {
          user.wallet.assets = user.wallet.assets.filter(
            (a: IAsset) => a.coin !== normalizedCoin
          );
        }

        await user.addTransaction(
          {
            coin: normalizedCoin,
            amount,
            price,
            type: "sell",
            date: new Date(),
          },
          session
        );
        await user.save({ session });
      });

      priceCache.del(`portfolio_${user._id}`);

      res.json({
        success: true,
        message: `فروش ${amount} ${coin} با موفقیت انجام شد`,
        data: {
          newBalance: user.wallet.balance,
          updatedAssets: user.wallet.assets,
        },
      });
      return; // ⚡ همینطور بدون return res.json(...)
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "خطا در انجام فروش" });
    }
  },
  // 📊 دریافت پورتفو
  async getPortfolio(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      const cacheKey = `portfolio_${user._id}`;
      let portfolioData = priceCache.get<PortfolioData>(cacheKey);

      if (!portfolioData) {
        const assets = user.wallet.assets as IAsset[];

        if (assets.length === 0) {
          portfolioData = {
            totalValue: user.wallet.balance,
            cashBalance: user.wallet.balance,
            assetsValue: 0,
            assets: [],
            profitLoss: user.wallet.balance - 10000,
            profitLossPercentage: ((user.wallet.balance - 10000) / 10000) * 100,
            currency: "USD",
            performance: {
              totalTransactions: user.transactions.length,
              totalTrades: user.transactions.length,
              successRate: calculateSuccessRate(user.transactions),
            },
          };
        } else {
          const coins = [...new Set(assets.map((a) => a.coin))];
          const marketPrices = await customApiService.getMultiplePrices(coins);

          let totalAssetsValue = 0;
          const assetsWithValue: UserAssetWithPrice[] = assets.map((asset) => {
            const marketInfo = marketPrices[asset.coin];
            const currentPrice = marketInfo?.lastPrice || 0;
            const valueInToman = asset.amount * currentPrice;
            const valueInDollar = valueInToman / 500000;

            totalAssetsValue += valueInDollar;

            return {
              ...asset,
              marketInfo: marketInfo || null,
              valueInToman: Math.round(valueInToman),
              valueInDollar: formatCurrency(valueInDollar),
              change24h: marketInfo?.change24h || 0,
              totalChange: marketInfo ? marketInfo.change24h * asset.amount : 0,
            };
          });

          const totalValue = user.wallet.balance + totalAssetsValue;
          const profitLoss = totalValue - 10000;
          const profitLossPercentage = (profitLoss / 10000) * 100;

          portfolioData = {
            totalValue: formatCurrency(totalValue),
            cashBalance: user.wallet.balance,
            assetsValue: formatCurrency(totalAssetsValue),
            assets: assetsWithValue,
            profitLoss: formatCurrency(profitLoss),
            profitLossPercentage: formatCurrency(profitLossPercentage),
            currency: "USD",
            performance: {
              totalTransactions: user.transactions.length,
              totalTrades: user.transactions.length,
              successRate: calculateSuccessRate(user.transactions),
            },
          };
        }

        priceCache.set(cacheKey, portfolioData);
      }

      res.json({
        success: true,
        data: { portfolio: portfolioData },
      });
    } catch (err) {
      console.error("Get portfolio error:", err);
      res.status(500).json({
        success: false,
        message: "خطا در دریافت اطلاعات پورتفو",
      });
    }
  },

  // 📜 تاریخچه تراکنش‌ها
  async getTransactions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const parsed = paginationSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: handleValidationError(parsed.error),
        });
        return;
      }

      const { page, limit, type, coin } = parsed.data;
      const userTransactions = req.user.transactions as ITransaction[];

      let transactions = [...userTransactions];

      // فیلترها
      if (type) {
        transactions = transactions.filter((t) => t.type === type);
      }
      if (coin) {
        transactions = transactions.filter(
          (t) => t.coin.toUpperCase() === coin.toUpperCase()
        );
      }

      // صفحه‌بندی
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTransactions = transactions.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          transactions: paginatedTransactions.reverse(),
          pagination: {
            currentPage: page,
            totalPages: Math.ceil(transactions.length / limit),
            totalTransactions: transactions.length,
            hasNext: endIndex < transactions.length,
            hasPrev: startIndex > 0,
          },
          summary: {
            totalBuy: transactions.filter((t) => t.type === "buy").length,
            totalSell: transactions.filter((t) => t.type === "sell").length,
            totalVolume: transactions.reduce(
              (total, t) => total + t.amount * t.price,
              0
            ),
          },
        },
      });
    } catch (err) {
      console.error("Get transactions error:", err);
      res.status(500).json({
        success: false,
        message: "خطا در دریافت تاریخچه تراکنش‌ها",
      });
    }
  },

  // 👤 اطلاعات پروفایل
  async getProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({ success: false, message: "کاربر یافت نشد" });
        return;
      }

      const wallet = user.wallet || { balance: 0, assets: [] };
      const assets = wallet.assets as IAsset[];

      res.json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            joinDate: user.createdAt,
            lastLogin: user.lastLogin,
            totalTransactions: user.transactions?.length || 0,
            wallet: {
              balance: wallet.balance,
              totalAssets: assets.length,
              totalValue:
                wallet.balance +
                assets.reduce((total, asset) => total + asset.amount, 0),
            },
          },
        },
      });
    } catch (err) {
      console.error("Get profile error:", err);
      res.status(500).json({
        success: false,
        message: "خطا در دریافت اطلاعات پروفایل",
      });
    }
  },
  // ✏️ آپدیت پروفایل
  async updateProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          success: false,
          message: handleValidationError(parsed.error),
        });
        return;
      }

      const { username } = parsed.data;
      const user = req.user;

      if (username) {
        user.username = username;
        await user.save();
      }

      res.json({
        success: true,
        message: "پروفایل با موفقیت بروزرسانی شد",
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
          },
        },
      });
    } catch (err) {
      console.error("Update profile error:", err);
      res.status(500).json({
        success: false,
        message: "خطا در بروزرسانی پروفایل",
      });
    }
  },

  async getAnalytics(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user;
      const transactions = user.transactions as ITransaction[];
      const assets = user.wallet.assets as IAsset[];

      const transactionStats = {
        total: transactions.length,
        buyCount: transactions.filter((t) => t.type === "buy").length,
        sellCount: transactions.filter((t) => t.type === "sell").length,
        totalVolume: transactions.reduce(
          (total, t) => total + t.amount * t.price,
          0
        ),
        mostTradedCoin: getMostTradedCoin(transactions),
        monthlyVolume: getMonthlyVolume(transactions),
        avgTradeSize: calculateAverageTradeSize(transactions),
      };

      const portfolioStats = {
        diversity: assets.length,
        topHolding:
          assets.length > 0
            ? assets.reduce((max, asset) =>
                asset.amount > max.amount ? asset : max
              )
            : null,
        riskScore: Math.min(assets.length * 10, 100),
        totalAssetsValue: assets.reduce(
          (total, asset) => total + asset.amount,
          0
        ),
      };

      const totalDays = Math.floor(
        (Date.now() - new Date(user.createdAt!).getTime()) / (1000 * 3600 * 24)
      );

      res.json({
        success: true,
        data: {
          transactionStats,
          portfolioStats,
          userStats: {
            joinDate: user.createdAt,
            totalDays: totalDays,
            successRate: calculateSuccessRate(transactions),
            tradingActivity:
              transactions.length > 0
                ? transactions.length / Math.max(1, totalDays)
                : 0,
          },
        },
      });
    } catch (err) {
      console.error("Get analytics error:", err);
      res.status(500).json({
        success: false,
        message: "خطا در دریافت آمار",
      });
    }
  },

  // 🌐 لیست مارکت‌ها
  async getAllMarkets(req: AuthRequest, res: Response): Promise<void> {
    try {
      const marketPrices = await customApiService.getAllMarketPrices();

      res.json({
        success: true,
        data: {
          markets: marketPrices,
          totalMarkets: marketPrices.length,
          lastUpdated: new Date().toISOString(),
        },
      });
    } catch (err) {
      console.error("Get all markets error:", err);
      res.status(500).json({
        success: false,
        message: "خطا در دریافت لیست مارکت‌ها",
      });
    }
  },

  async getCurrencyInfo(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { coin } = req.params;
      const user = req.user;

      const marketInfo = await customApiService.findMarketByBaseAsset(coin);
      if (!marketInfo) {
        res.status(404).json({
          success: false,
          message: `ارز ${coin} یافت نشد`,
        });
        return;
      }

      const userAsset = (user.wallet.assets as IAsset[]).find(
        (a) => a.coin.toUpperCase() === coin.toUpperCase()
      );

      const userHolding = userAsset
        ? {
            amount: userAsset.amount,
            valueInToman: userAsset.amount * marketInfo.lastPrice,
            valueInDollar: (userAsset.amount * marketInfo.lastPrice) / 500000,
          }
        : null;

      res.json({
        success: true,
        data: {
          market: marketInfo,
          userHolding,
        },
      });
    } catch (err) {
      console.error("Get currency info error:", err);
      res.status(500).json({
        success: false,
        message: "خطا در دریافت اطلاعات ارز",
      });
    }
  },
  async toggleLikeCoin(req: Request, res: Response) {
    try {
      const userId = req.body.userId; // از auth یا body
      const { coin } = req.body;

      if (!coin)
        return res.status(400).json({ error: "symbol کوین الزامی است" });

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "کاربر یافت نشد" });

      if (user.likedCoins.includes(coin)) {
        user.likedCoins = user.likedCoins.filter((c) => c !== coin);
      } else {
        user.likedCoins.push(coin);
      }

      await user.save();
      res.json({
        message: user.likedCoins.includes(coin)
          ? `${coin} به لیست علاقه‌مندی‌ها اضافه شد`
          : `${coin} از علاقه‌مندی‌ها حذف شد`,
        likedCoins: user.likedCoins,
      });
    } catch (err) {
      console.error("❌ toggleLikeCoin error:", err);
      res.status(500).json({ error: "خطا در تغییر وضعیت لایک کوین" });
    }
  },

  async toggleBookmarkCoin(req: Request, res: Response) {
    try {
      const { userId } = req.body;
      const { coin } = req.body;

      if (!coin)
        return res.status(400).json({ error: "symbol کوین الزامی است" });

      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "کاربر یافت نشد" });

      // بررسی وجود در بوکمارک‌ها
      if (user.bookmarkedCoins.includes(coin)) {
        user.bookmarkedCoins = user.bookmarkedCoins.filter((c) => c !== coin);
      } else {
        user.bookmarkedCoins.push(coin);
      }

      await user.save();
      res.json({
        message: user.bookmarkedCoins.includes(coin)
          ? `${coin} به بوکمارک اضافه شد`
          : `${coin} از بوکمارک حذف شد`,
        bookmark: user.bookmarkedCoins,
      });
    } catch (err) {
      console.error("❌ toggleBookmarkCoin error:", err);
      res.status(500).json({ error: "خطا در بوکمارک کردن کوین" });
    }
  },
};
