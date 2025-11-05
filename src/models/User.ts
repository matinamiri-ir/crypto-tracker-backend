// src/models/User.ts
import mongoose, { Document, Schema } from "mongoose";
export interface ITransaction {
  coin: string;
  amount: number;
  price: number;
  type: "buy" | "sell";
  date: Date;
}

export interface IAsset {
  coin: string;
  amount: number;
}

export interface IWallet {
  balance: number;
  assets: IAsset[];
}

export interface IUserProfile {
  verified: boolean;
  joinDate: Date;
  notifications?: boolean;
}

export interface IUser extends Document {
  id: string;
  username: string;
  email: string;
  password?: string;
  provider: "local" | "google" | "github";
  googleId?: string;
  avatar?: string;
  githubId?: string;
  lastLogin?: Date;
  createdAt?: Date;
  updatedAt?: Date;

  wallet: IWallet;
  transactions: ITransaction[];
  profile?: IUserProfile;
  likedCoins: string[];
  bookmarkedCoins: string[];
  addTransaction: (tx: ITransaction) => Promise<void>;
  reload: () => Promise<IUser>;
}

const transactionSchema = new Schema<ITransaction>({
  coin: { type: String, required: true },
  amount: { type: Number, required: true },
  price: { type: Number, required: true },
  type: { type: String, enum: ["buy", "sell"], required: true },
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
  googleId: { type: String },
  githubId: { type: String },
  wallet: {
    balance: { type: Number, default: 0 },
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

userSchema.methods.addTransaction = async function (tx: ITransaction) {
  this.transactions.push(tx);

  if (tx.type === "buy") {
    this.wallet.balance -= tx.price * tx.amount; 
    const asset = this.wallet.assets.find((a :IAsset) => a.coin === tx.coin);
    if (asset) {
      asset.amount += tx.amount;
    } else {
      this.wallet.assets.push({ coin: tx.coin, amount: tx.amount });
    }
  } else if (tx.type === "sell") {
    this.wallet.balance += tx.price * tx.amount;
    const asset = this.wallet.assets.find((a:IAsset) => a.coin === tx.coin);
    if (asset) {
      asset.amount -= tx.amount;
    }
  }

  await this.save();
};

export const User = mongoose.model<IUser>("User", userSchema);
