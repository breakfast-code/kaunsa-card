import { describe, expect, it } from "vitest";
import { clearWallet, LEGACY_WALLET_KEY, readWallet, shouldRestoreAccount, WALLET_KEY, writeWallet } from "./wallet-storage";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    values,
  };
}

const supported = new Set(["hsbc-premier", "axis-atlas"]);

describe("wallet storage", () => {
  it("filters unsupported, duplicate, and inactive card IDs", () => {
    const storage = memoryStorage({
      [WALLET_KEY]: JSON.stringify({ saved: ["hsbc-premier", "missing", "hsbc-premier"], active: ["axis-atlas", "hsbc-premier"] }),
    });
    expect(readWallet(storage, supported)).toEqual({ saved: ["hsbc-premier"], active: ["hsbc-premier"] });
  });

  it("migrates the legacy array shape when read", () => {
    const storage = memoryStorage({ [LEGACY_WALLET_KEY]: JSON.stringify(["axis-atlas"]) });
    expect(readWallet(storage, supported)).toEqual({ saved: ["axis-atlas"], active: ["axis-atlas"] });
  });

  it("clears corrupt wallet data", () => {
    const storage = memoryStorage({ [WALLET_KEY]: "{" });
    expect(readWallet(storage, supported)).toEqual({ saved: [], active: [] });
    expect(storage.values.has(WALLET_KEY)).toBe(false);
  });

  it("writes only the current key and clears both keys on logout", () => {
    const storage = memoryStorage({ [LEGACY_WALLET_KEY]: "[]" });
    writeWallet(storage, { saved: ["hsbc-premier"], active: ["hsbc-premier"] });
    expect(storage.values.has(LEGACY_WALLET_KEY)).toBe(false);
    expect(storage.values.has(WALLET_KEY)).toBe(true);
    clearWallet(storage);
    expect(storage.values.size).toBe(0);
  });

  it("restores each authenticated account once", () => {
    expect(shouldRestoreAccount("user-a", null)).toBe(true);
    expect(shouldRestoreAccount("user-a", "user-a")).toBe(false);
    expect(shouldRestoreAccount("user-b", "user-a")).toBe(true);
    expect(shouldRestoreAccount(undefined, "user-a")).toBe(false);
  });
});
