import express, { Request, Response } from "express";
import axios from "axios";
import type {
  Market,
  MarketResponse,
  OldMarketsResponse,
  OldMarket,
  CryptocurrencyResponse,
  CryptocurrencyData,
} from "../types/markets";
import { success, symbol } from "zod";

const router = express.Router();

function groupByBase<T extends { [key: string]: any }>(
  items: T[],
  key: string
): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const base = item[key];
    if (!acc[base]) acc[base] = [];
    acc[base].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

// 📈 Markets
router.get("/markets", async (req: Request, res: Response) => {
  const base = req.query.base?.toString().toUpperCase(); // normalize base name
  try {
    const urls = [
      { name: "v1/market", url: "https://api.wallex.ir/hector/web/v1/markets" },
      { name: "old/market", url: "https://api.wallex.ir/v1/markets" },
    ];

    // گرفتن هر دو API هم‌زمان
    const [newMarketRes, oldMarketRes] = await Promise.all([
      axios.get<MarketResponse>(urls[0].url),
      axios.get<OldMarketsResponse>(urls[1].url),
    ]);

    const newMarkets: Market[] = newMarketRes.data.result.markets;
    const oldMarkets: OldMarket[] = Object.values(
      oldMarketRes.data.result.symbols
    );

    const groupedNew = groupByBase(newMarkets, "base_asset");
    const groupedOld = groupByBase(oldMarkets, "baseAsset");

    const result = Object.keys(groupedNew).map((base) => {
      let newM = groupedNew[base];
      let oldM = groupedOld[base] || [];

      newM = newM.sort((a, b) => {
        if (a.is_tmn_based && !b.is_tmn_based) return -1;
        if (!a.is_tmn_based && b.is_tmn_based) return 1;
        return 0;
      });

      oldM = oldM.sort((a, b) => {
        const aTmn = a.symbol?.includes("TMN");
        const bTmn = b.symbol?.includes("TMN");
        if (aTmn && !bTmn) return -1;
        if (!aTmn && bTmn) return 1;
        return 0;
      });

      const price: { toman?: number; tether?: number } = {};
      newM.forEach((m) => {
        const p = parseFloat(m.price);
        if (m.is_tmn_based) price.toman = p;
        if (m.is_usdt_based) price.tether = p;
      });

      const svg = oldM[0]?.baseAsset_svg_icon;

      return {
        base,
        newMarkets: newM,
        oldMarkets: oldM,
        price,
        svg,
      };
    });

    const coinResult = result.find((coin) => coin.base === base);

    if (!base) {
      res.json({
        success: true,
        message: "Markets grouped and sorted successfully",
        count: result.length,
        data: result,
      });
    } else if (coinResult) {
      res.json({
        success: true,
        message: `Market for ${base} fetched successfully`,
        data: coinResult,
      });
    } else {
      res.status(404).json({
        success: false,
        message: `No market found for base ${base}`,
      });
    }
  } catch (err) {
    console.error("❌ Error fetching markets:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch markets",
    });
  }
});
router.get("/market/:symbol", async (req: Request, res: Response) => {
  const { symbol } = req.params;
  if (!symbol) {
    return res.status(400).json({ message: "لطفا سمبل ارز را وارد کنید" });
  }
  try {
    const [market, oldMarket] = await Promise.all([
      axios.get<MarketResponse>("https://api.wallex.ir/hector/web/v1/markets"),
      axios.get<OldMarketsResponse>("https://api.wallex.ir/v1/markets"),
    ]);
    const newMarkets: Market[] = market.data.result.markets || [];
    const oldMarkets: OldMarket[] = Object.values(
      oldMarket.data.result.symbols || {}
    );

    const symbolledNm = newMarkets.find((market) => market.symbol === symbol);
    const symbolledOm = oldMarkets.find((coin) => coin.symbol === symbol);
    if (!symbolledNm && !symbolledOm) {
      return res.status(404).json({
        success: false,
        message: "ارز مورد نظر یافت نشد",
      });
    }
    res.json({
      success: true,
      data: {
        nmSymbol: symbolledNm,
        omSymbol: symbolledOm,
      },
    });
  } catch (err) {
    console.error("❌ Error fetching markets:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch markets",
    });
  }
});

// 💹 Old Markets
router.get("/oldmarkets", async (req: Request, res: Response) => {
  try {
    const response = (await axios.get("https://api.wallex.ir/v1/markets")) as {
      data: OldMarketsResponse;
    };
    const oldMarketArray: OldMarket[] = Object.values(
      response.data.result.symbols
    );
    res.json(oldMarketArray);
  } catch (err) {
    console.error("Error fetching old markets:", err);
    res.status(500).json({ error: "Failed to fetch old markets" });
  }
});

// 📊 Currencies Stats
router.get("/currencies/stats", async (req: Request, res: Response) => {
  try {
    const response = (await axios.get(
      "https://api.wallex.ir/v1/currencies/stats"
    )) as {
      data: CryptocurrencyResponse;
    };

    res.json(response.data.result);
  } catch (err) {
    console.error("Error fetching currencies:", err);
    res.status(500).json({ error: "Failed to fetch currencies" });
  }
});

// 🔗 Related Coins
router.get("/related/coin/:symbol", async (req: Request, res: Response) => {
  const { symbol } = req.params;
  if (!symbol) return res.status(400).json({ error: "Symbol is required" });

  try {
    const resp = (await axios.get(
      "https://api.wallex.ir/hector/web/v1/markets"
    )) as {
      data: MarketResponse;
    };
    const markets = resp.data?.result.markets;
    const current_coin = markets.find(
      (coin: Market) => coin.symbol.toUpperCase() === symbol.toUpperCase()
    );
    if (!current_coin) return res.status(404).json({ error: "Coin not found" });

    const related = markets
      .filter(
        (coin: Market) =>
          coin.symbol.toUpperCase() !== symbol.toUpperCase() &&
          coin.categories?.some((cat) => current_coin.categories.includes(cat))
      )
      .slice(0, 20);

    const setArray = new Set(related.map((coin) => coin.symbol.toUpperCase()));

    const oldMarket = (await axios.get(
      "https://crypto-tracker-backend-xt56.onrender.com/api/oldmarkets"
    )) as {
      data: OldMarket[];
    };

    const filteredOldMarket = Object.values(
      oldMarket.data
        .filter((m) => setArray.has(m.symbol.toUpperCase()))
        .reduce((acc, coin) => {
          if (!acc[coin.baseAsset]) {
            acc[coin.baseAsset] = {
              base: coin.baseAsset,
              coins: [],
              svg_icon: coin.baseAsset_svg_icon,
              faBase: coin.faBaseAsset,
            };
          }
          acc[coin.baseAsset].coins.push(coin);
          acc[coin.baseAsset].coins.sort((a, b) => {
            if (a.quoteAsset === "USDT") return -1; // بیاد جلوتر
            if (b.quoteAsset === "USDT") return 1; // بره عقب‌تر
            return 0;
          });
          return acc;
        }, {} as Record<string, { base: string; coins: OldMarket[]; svg_icon: string; faBase: string }>)
    );

    res.json(filteredOldMarket);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 🔍 Single Coin
router.get("/coin/:baseAsset", async (req: Request, res: Response) => {
  const { baseAsset } = req.params;
  try {
    const response = (await axios.get(
      "https://crypto-tracker-backend-xt56.onrender.com/api/oldmarkets"
    )) as {
      data: OldMarket[];
    };
    const base_asset = response.data.filter(
      (coin) => coin.baseAsset === baseAsset
    );

    if (base_asset.length === 0) {
      return res.status(404).json({ error: "Coin not found" });
    }

    res.json(base_asset);
  } catch (err) {
    console.error("Error fetching coin:", err);
    res.status(500).json({ error: "Failed to fetch coin" });
  }
});

export default router;
