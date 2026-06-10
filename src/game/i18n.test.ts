import { describe, it, expect } from "vitest";
import { messages, LOCALES, setLocale, t, tn } from "./i18n";

describe("i18n catalogs", () => {
  const base = Object.keys(messages.en).sort();

  it("offers a catalog for every advertised locale", () => {
    for (const { code } of LOCALES) expect(messages[code]).toBeDefined();
  });

  for (const { code } of LOCALES) {
    it(`${code} has exactly the same keys as en (no missing/extra)`, () => {
      expect(Object.keys(messages[code]).sort()).toEqual(base);
    });
  }
});

describe("t / tn", () => {
  it("interpolates named params", () => {
    setLocale("en");
    expect(t("announce.cursor", { row: 2, col: 3 })).toBe("cursor row 2, column 3");
  });

  it("falls back to the key when it is unknown", () => {
    setLocale("en");
    expect(t("does.not.exist")).toBe("does.not.exist");
  });

  it("picks the right plural form", () => {
    setLocale("en");
    expect(tn("announce.solved", 1)).toBe("solved in 1 move");
    expect(tn("announce.solved", 3)).toBe("solved in 3 moves");
    setLocale("fr");
    expect(tn("announce.solved", 1)).toBe("résolu en 1 coup");
    expect(tn("announce.solved", 3)).toBe("résolu en 3 coups");
    setLocale("en");
  });
});
