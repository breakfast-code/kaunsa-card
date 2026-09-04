export type StoredWallet = { saved: string[]; active: string[] };

type BrowserStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const WALLET_KEY = "kaunsa-card-wallet-v2";
export const LEGACY_WALLET_KEY = "kaunsa-card-wallet";

const uniqueSupported = (values: unknown, supportedIds: ReadonlySet<string>) =>
  Array.isArray(values)
    ? [...new Set(values.filter((value): value is string => typeof value === "string" && supportedIds.has(value)))]
    : [];

export function readWallet(storage: BrowserStorage, supportedIds: ReadonlySet<string>): StoredWallet {
  const current = storage.getItem(WALLET_KEY);
  const legacy = storage.getItem(LEGACY_WALLET_KEY);
  if (!current && !legacy) return { saved: [], active: [] };

  try {
    const parsed: unknown = JSON.parse(current ?? legacy ?? "null");
    const rawSaved = current && parsed && typeof parsed === "object" && "saved" in parsed
      ? (parsed as { saved?: unknown }).saved
      : parsed;
    const rawActive = current && parsed && typeof parsed === "object" && "active" in parsed
      ? (parsed as { active?: unknown }).active
      : parsed;
    const saved = uniqueSupported(rawSaved, supportedIds);
    const savedSet = new Set(saved);
    const active = uniqueSupported(rawActive, supportedIds).filter((id) => savedSet.has(id));
    return { saved, active };
  } catch {
    clearWallet(storage);
    return { saved: [], active: [] };
  }
}

export function writeWallet(storage: BrowserStorage, wallet: StoredWallet): void {
  storage.setItem(WALLET_KEY, JSON.stringify(wallet));
  storage.removeItem(LEGACY_WALLET_KEY);
}

export function clearWallet(storage: BrowserStorage): void {
  storage.removeItem(WALLET_KEY);
  storage.removeItem(LEGACY_WALLET_KEY);
}

export function shouldRestoreAccount(accountId: string | undefined, restoredAccountId: string | null): boolean {
  return Boolean(accountId && accountId !== restoredAccountId);
}
