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

const router = express.Router();

// 📈 Markets
router.get("/markets", async (req: Request, res: Response) => {
  try {
    const response = (await axios.get(
      "https://api.wallex.ir/hector/web/v1/markets"
    )) as {
      data: MarketResponse;
    };

    const marketsArray: Market[] = Object.values(response.data.result.markets);
    res.json(marketsArray);
  } catch (err) {
    console.error("Error fetching markets:", err);
    res.status(500).json({ error: "Failed to fetch markets" });
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
      "https://crypto-tracker-backend-xt56.onrender.com/api/markets"
    )) as {
      data: Market[];
    };

    const current_coin = resp.data.find(
      (coin) => coin.symbol.toUpperCase() === symbol.toUpperCase()
    );
    if (!current_coin) return res.status(404).json({ error: "Coin not found" });

    const related = resp.data
      .filter(
        (coin) =>
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

    const filteredOldMarket = oldMarket.data.filter((m) =>
      setArray.has(m.symbol.toUpperCase())
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
