import { Request, Response, NextFunction } from 'express';

export const validateRegister = (req: Request, res: Response, next: NextFunction) => {
  const { email, password, username } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'ایمیل و رمز عبور الزامی است'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'رمز عبور باید حداقل ۶ کاراکتر باشد'
    });
  }

  if (username && username.length < 3) {
    return res.status(400).json({
      success: false,
      message: 'نام کاربری باید حداقل ۳ کاراکتر باشد'
    });
  }

  next();
};

export const validateTransaction = (req: Request, res: Response, next: NextFunction) => {
  const { coin, amount, price } = req.body;

  if (!coin || !amount || !price) {
    return res.status(400).json({
      success: false,
      message: 'اطلاعات تراکنش ناقص است'
    });
  }

  if (amount <= 0 || price <= 0) {
    return res.status(400).json({
      success: false,
      message: 'مقدار و قیمت باید بزرگتر از صفر باشد'
    });
  }

  next();
};