import axios from "axios";
import NodeCache from "node-cache";

const cache = new NodeCache({ stdTTL: 60 });
const CACHE_KEY = "usdt_toman_rate";

async function fetchFromExir(): Promise<number | null> {
  try {
    const res = await axios.get(
      "https://api.exir.io/v1/ticker?symbol=usdt-irt"
    );
    const price = Number(res.data?.open || res.data?.last);
    return isNaN(price) ? null : price;
  } catch {
    return null;
  }
}

async function fetchFromWallex(): Promise<number | null> {
  try {
    const res = await axios.get("https://api.wallex.ir/v1/markets");
    const usdt = res.data?.data?.markets?.find(
      (m: any) => m.symbol === "USDTTMN"
    );
    const price = Number(usdt?.stats?.lastPrice);
    return isNaN(price) ? null : price;
  } catch {
    return null;
  }
}

export async function getUsdtRate(): Promise<number> {
  const cached = cache.get<number>(CACHE_KEY);
  if (cached) return cached;

  const providers = [fetchFromExir, fetchFromWallex];

  for (const provider of providers) {
    const rate = await provider();
    if (rate && rate > 0) {
      cache.set(CACHE_KEY, rate);
      return rate;
    }
  }

  const fallback = 100000;
  cache.set(CACHE_KEY, fallback);
  return fallback;
}

export async function convertUsdtToToman(usdt: number): Promise<number> {
  const rate = await getUsdtRate();
  return usdt * rate;
}

export async function convertTomanToUsdt(toman: number): Promise<number> {
  const rate = await getUsdtRate();
  return toman / rate;
}
