export interface MarketResponse {
  
  result: {
    markets: Market[];
  };
}

export interface Market {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  fa_base_asset: string;
  fa_quote_asset: string;
  en_base_asset: string;
  en_quote_asset: string;
  categories: number[];
  price: string; // API داره string می‌ده، تو کد می‌تونی parseFloat کنی
  change_24h: number;
  volume_24h: number;
  change_7D: number;
  quote_volume_24h: number;
  spot_is_new: boolean;
  otc_is_new: boolean;
  is_new: boolean;
  is_spot: boolean;
  is_otc: boolean;
  is_margin: boolean;
  is_tmn_based: boolean;
  is_usdt_based: boolean;
  is_zero_fee: boolean;
  leverage_step: number;
  max_leverage: number;
  created_at: string; // ISO date
  amount_precision: number;
  price_precision: number;
  flags: string[];
  is_market_type_enable: boolean;
}
interface Direction{
    SELL:number;
    BUY:number
}
export type OldMarketStats = {
  bidPrice: string;
  askPrice: string;
  "24h_ch": number;
  "7d_ch": number;
  "24h_volume": string;
  "7d_volume": string;
  "24h_quoteVolume": string;
  "24h_highPrice": string;
  "24h_lowPrice": string;
  lastPrice: string;
  lastQty: string;
  lastTradeSide: "BUY" | "SELL";
  bidVolume: string;
  askVolume: string;
  bidCount: number;
  askCount: number;
  direction: {
    SELL: number;
    BUY: number;
  };
  "24h_tmnVolume": string;
};
export type OldMarket = {
  symbol: string;
  baseAsset: string;
  baseAsset_png_icon: string;
  baseAsset_svg_icon: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quoteAsset_png_icon: string;
  quoteAsset_svg_icon: string;
  quotePrecision: number;
  faName: string;
  enName: string;
  faBaseAsset: string;
  enBaseAsset: string;
  faQuoteAsset: string;
  enQuoteAsset: string;
  stepSize: number;
  tickSize: number;
  minQty: number;
  minNotional: number;
  stats: OldMarketStats;
  createdAt: string; // یا Date اگه میخوای parse کنی
  isNew: boolean;
  isZeroFee: boolean;
  isMarketTypeEnable: boolean;
};

// تایپ کل ریسپانس
export interface OldMarketsResponse {
  success: boolean;
  message: string;
  result: {
    symbols: Record<string, OldMarket>;
  };
}
export interface CryptocurrencyData {
  key: string;
  name: string;
  name_en: string;
  rank: number;
  dominance: number;
  volume_24h: number;
  market_cap: number;
  ath: number;
  atl: number;
  ath_change_percentage: number;
  ath_date: string;
  price: number;
  daily_high_price: number;
  daily_low_price: number;
  weekly_high_price: number;
  monthly_high_price: number;
  yearly_high_price: number;
  weekly_low_price: number;
  monthly_low_price: number;
  yearly_low_price: number;
  percent_change_1h: number;
  percent_change_24h: number;
  percent_change_7d: number;
  percent_change_14d: number;
  percent_change_30d: number;
  percent_change_60d: number;
  percent_change_200d: number;
  percent_change_1y: number;
  price_change_24h: number;
  price_change_7d: number;
  price_change_14d: number;
  price_change_30d: number;
  price_change_60d: number;
  price_change_200d: number;
  price_change_1y: number;
  max_supply: number;
  total_supply: number;
  circulating_supply: number;
  type: string;
  created_at: string;
  updated_at: string;
}
export interface CryptocurrencyResponse {
  result: CryptocurrencyData[];
}