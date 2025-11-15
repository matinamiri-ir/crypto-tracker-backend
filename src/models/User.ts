// src/models/User.ts
import mongoose, { Document, Schema } from "mongoose";

export type Currency = "TMN" | "USDT";

export interface ITransaction {
  coin: string;
  amount: number;
  price: number;
  type: "buy" | "sell";
  currency: Currency; // 🆕
  date: Date;
}

export interface IAsset {
  coin: string;
  amount: number;
}

export interface IWallet {
  balance: {
    tmn: number;
    usdt: number;
  };
  assets: IAsset[];
}

export interface IUserProfile {
  verified: boolean;
  joinDate: Date;
  notifications?: boolean;
}

export interface IUser extends Document {
  username: string;
  email: string;
  password?: string;
  provider: "local" | "google" | "github";
  googleId?: string;
  githubId?: string;
  lastLogin?: Date;

  wallet: IWallet;
  transactions: ITransaction[];

  likedCoins: string[];
  bookmarkedCoins: string[];

  addTransaction: (tx: ITransaction) => Promise<void>;
}

const transactionSchema = new Schema<ITransaction>({
  coin: { type: String, required: true },
  amount: { type: Number, required: true },
  price: { type: Number, required: true },
  type: { type: String, enum: ["buy", "sell"], required: true },
  currency: { type: String, enum: ["TMN", "USDT"], required: true }, // 🆕
  date: { type: Date, default: Date.now },
});

const userSchema = new Schema<IUser>({
  username: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  provider: {
    type: String,
    enum: ["local", "google", "github"],
    default: "local",
  },

  wallet: {
    balance: {
      tmn: { type: Number, default: 0 },
      usdt: { type: Number, default: 0 },
    },
    assets: [
      {
        coin: { type: String },
        amount: { type: Number, default: 0 },
      },
    ],
  },

  transactions: [transactionSchema],
  likedCoins: { type: [String], default: [] },
  bookmarkedCoins: { type: [String], default: [] },
});

// 🧠 بخش مهم → مدیریت تراکنش با توجه به واحد پولی
userSchema.methods.addTransaction = async function (tx: ITransaction) {
  this.transactions.push(tx);

  const balanceKey = tx.currency.toLowerCase(); // "tmn" | "usdt"

  if (tx.type === "buy") {
    this.wallet.balance[balanceKey] -= tx.price * tx.amount;

    const asset = this.wallet.assets.find((a:IAsset) => a.coin === tx.coin);
    if (asset) asset.amount += tx.amount;
    else this.wallet.assets.push({ coin: tx.coin, amount: tx.amount });

  } else if (tx.type === "sell") {
    this.wallet.balance[balanceKey] += tx.price * tx.amount;

    const asset = this.wallet.assets.find((a:IAsset) => a.coin === tx.coin);
    if (asset) asset.amount -= tx.amount;
  }

  await this.save();
};

export const User = mongoose.model<IUser>("User", userSchema);
