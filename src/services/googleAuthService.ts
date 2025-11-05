import { OAuth2Client } from 'google-auth-library';
import { User } from '../models/User';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export interface GoogleUserInfo {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}

export class GoogleAuthService {
  // بررسی اعتبار توکن گوگل
  static async verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      
      if (!payload) {
        throw new Error('Invalid token payload');
      }

      return {
        googleId: payload.sub,
        email: payload.email!,
        name: payload.name!,
        picture: payload.picture,
      };
    } catch (error) {
      console.error('Google token verification error:', error);
      throw new Error('توکن گوگل نامعتبر است');
    }
  }

  // پیدا کردن یا ایجاد کاربر
  static async findOrCreateUser(googleUser: GoogleUserInfo) {
    try {
      // بررسی وجود کاربر با googleId
      let user = await User.findOne({ googleId: googleUser.googleId });

      if (user) {
        console.log('✅ کاربر با googleId پیدا شد');
        user.lastLogin = new Date();
        await user.save();
        return user;
      }

      // بررسی وجود کاربر با ایمیل
      user = await User.findOne({ email: googleUser.email });

      if (user) {
        console.log('✅ کاربر با ایمیل پیدا شد - اتصال حساب گوگل');
        // اتصال حساب گوگل به کاربر موجود
        user.googleId = googleUser.googleId;
        user.provider = 'google';
        user.lastLogin = new Date();
        await user.save();
        return user;
      }

      // ایجاد کاربر جدید
      console.log('🆕 ایجاد کاربر جدید');
      const newUser = new User({
        googleId: googleUser.googleId,
        provider: 'google',
        email: googleUser.email,
        username: this.generateUsername(googleUser.name, googleUser.email),
        lastLogin: new Date(),
        profile: {
          verified: true,
          joinDate: new Date(),
          notifications: true,
        },
        wallet: {
          balance: 0,
          assets: [],
        },
        transactions: [],
      });

      await newUser.save();
      return newUser;

    } catch (error) {
      console.error('Error in findOrCreateUser:', error);
      throw error;
    }
  }

  // تولید نام کاربری
  private static generateUsername(name: string, email: string): string {
    const baseUsername = name.replace(/\s+/g, '').toLowerCase();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `${baseUsername}_${randomSuffix}`;
  }

  // احراز هویت اصلی
  static async authenticate(idToken: string) {
    try {
      console.log('🔐 شروع فرآیند احراز هویت گوگل...');
      
      // بررسی توکن گوگل
      const googleUser = await this.verifyGoogleToken(idToken);
      console.log('✅ توکن گوگل تایید شد:', googleUser.email);

      // پیدا کردن یا ایجاد کاربر
      const user = await this.findOrCreateUser(googleUser);
      console.log('✅ کاربر آماده است:', user.email);

      return user;

    } catch (error) {
      console.error('❌ خطا در احراز هویت گوگل:', error);
      throw error;
    }
  }
}