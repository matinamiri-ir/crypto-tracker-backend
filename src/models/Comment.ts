import mongoose, { Schema, Document, Types } from "mongoose";

export interface IComment extends Document {
  userId: Types.ObjectId;
  username?: string;
  symbol?: string; // مثلاً BTC، ETH، ...
  text: string;
  likes: Types.ObjectId[];
  dislikes: Types.ObjectId[];
  hidden?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    username: { type: String },
    symbol: { type: String, index: true },
    text: { type: String, required: true, trim: true },
    likes: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    dislikes: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    hidden: { type: Boolean, default: false },
  },
  {
    timestamps: true, // خودش createdAt و updatedAt اضافه می‌کنه
  }
);

// اگه بخوای rating رو مستقیم با virtual حساب کنی (بدون backend map)
CommentSchema.virtual("rating").get(function (this: IComment) {
  const total = this.likes.length + this.dislikes.length;
  if (total === 0) return 0;
  return Math.round((this.likes.length / total) * 5);
});

export const Comment = mongoose.model<IComment>("Comment", CommentSchema);
