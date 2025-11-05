import axios from 'axios';

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
  createdAt: string;
  isNew: boolean;
  isZeroFee: boolean;
  isMarketTypeEnable: boolean;
};

export interface MarketPriceInfo {
  symbol: string;
  baseAsset: string;
  lastPrice: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  faName: string;
  enName: string;
}

export class CustomApiService {
  private baseURL = 'https://crypto-tracker-backend-xt56.onrender.com/api';

  async getAllMarkets(): Promise<OldMarket[]> {
    try {
      const response = await axios.get<OldMarket[]>(`${this.baseURL}/oldmarkets`);
      return response.data;
    } catch (error) {
      console.error('Error fetching markets from custom API:', error);
      throw new Error('خطا در دریافت اطلاعات از سرور اختصاصی');
    }
  }

  async getAllMarketPrices(): Promise<MarketPriceInfo[]> {
    try {
      const markets = await this.getAllMarkets();
      
      return markets.map((market: OldMarket): MarketPriceInfo => ({
        symbol: market.symbol,
        baseAsset: market.baseAsset,
        lastPrice: parseFloat(market.stats.lastPrice),
        change24h: market.stats["24h_ch"],
        high24h: parseFloat(market.stats["24h_highPrice"]),
        low24h: parseFloat(market.stats["24h_lowPrice"]),
        volume24h: parseFloat(market.stats["24h_volume"]),
        faName: market.faName,
        enName: market.enName
      }));
    } catch (error) {
      console.error('Error processing market prices:', error);
      throw error;
    }
  }

  async findMarketByBaseAsset(baseAsset: string): Promise<MarketPriceInfo | null> {
    try {
      const marketPrices = await this.getAllMarketPrices();
      const normalizedAsset = baseAsset.toUpperCase();
      
      return marketPrices.find(market => 
        market.baseAsset.toUpperCase() === normalizedAsset
      ) || null;
    } catch (error) {
      console.error(`Error finding market for ${baseAsset}:`, error);
      return null;
    }
  }

  async getMultiplePrices(baseAssets: string[]): Promise<{ [key: string]: MarketPriceInfo | null }> {
    try {
      const marketPrices = await this.getAllMarketPrices();
      const result: { [key: string]: MarketPriceInfo | null } = {};
      
      baseAssets.forEach(asset => {
        const normalizedAsset = asset.toUpperCase();
        const market = marketPrices.find(m => 
          m.baseAsset.toUpperCase() === normalizedAsset
        );
        result[asset] = market || null;
      });
      
      return result;
    } catch (error) {
      console.error('Error fetching multiple prices:', error);
      throw error;
    }
  }
}

export const customApiService = new CustomApiService();