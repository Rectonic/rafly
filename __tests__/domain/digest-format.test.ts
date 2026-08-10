import { formatDigestRu } from "@/lib/domain/digest-format";
import type { OwnerDigestV2 } from "@/lib/contracts";

function digest(overrides: Partial<OwnerDigestV2> = {}): OwnerDigestV2 {
  return {
    storeName: "Магазин у дома",
    generatedAt: "2026-08-11T08:05:00.000Z",
    staleVerification: [],
    expiryRisk: [],
    openExceptions: [],
    pausedOffers: [],
    countActivity7d: { daysWithCountSession: 0, days: 7 },
    offers7d: {
      published: 0,
      fulfilled: 0,
      cancelledBySeller: 0,
      expiredNoShow: 0,
      failedStockMismatch: 0,
    },
    ...overrides,
  };
}

describe("formatDigestRu", () => {
  it("formats every factual section as emoji-free Telegram-ready Russian text", () => {
    const text = formatDigestRu(
      digest({
        staleVerification: [
          {
            productName: "Молоко 1 л",
            onHand: 1200,
            lastVerifiedAt: null,
          },
        ],
        expiryRisk: [
          {
            productName: "Йогурт",
            expiryDate: "2026-08-12",
            daysToExpiry: 1,
            onHand: 8,
          },
        ],
        openExceptions: [
          {
            kind: "stock_mismatch",
            message: "На полке меньше товара",
            createdAt: "2026-08-11T07:00:00.000Z",
          },
        ],
        pausedOffers: [
          {
            title: "Набор выпечки",
            pausedSinceVersionNote: null,
          },
        ],
        countActivity7d: { daysWithCountSession: 3, days: 7 },
        offers7d: {
          published: 12,
          fulfilled: 7,
          cancelledBySeller: 2,
          expiredNoShow: 1,
          failedStockMismatch: 3,
        },
      })
    );

    expect(text).toBe(
      [
        "Сводка дня: Магазин у дома",
        "Сформировано: 11.08.2026 08:05 UTC",
        "",
        "Давно не проверялось",
        "01. Молоко 1 л | остаток 1 200 | не проверялось",
        "",
        "Срок годности до 3 дней",
        "01. Йогурт | 12.08.2026 | 1 дн. | остаток 8",
        "",
        "Открытые исключения",
        "01. расхождение стока | На полке меньше товара | 11.08.2026 07:00 UTC",
        "",
        "Приостановленные офферы",
        "01. Набор выпечки | время паузы не хранится",
        "",
        "Пересчёты за 7 дней",
        "дней с пересчётом: 3 из 7",
        "",
        "Офферы за 7 дней",
        "опубликовано: 12",
        "выдано: 7",
        "отменено продавцом: 2",
        "неявка: 1",
        "не хватило стока: 3",
        "",
        "итого: 4 задач на сегодня",
      ].join("\n")
    );
    expect(text).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    expect(text.toLowerCase()).not.toContain("продаж");
    expect(text.toLowerCase()).not.toContain("мёртв");
  });

  it("omits every empty section and reports an honest zero", () => {
    expect(formatDigestRu(digest())).toBe(
      [
        "Сводка дня: Магазин у дома",
        "Сформировано: 11.08.2026 08:05 UTC",
        "",
        "итого: 0 задач на сегодня",
      ].join("\n")
    );
  });

  it("renders only the one non-empty section", () => {
    const text = formatDigestRu(
      digest({
        pausedOffers: [
          { title: "Вечерний набор", pausedSinceVersionNote: null },
        ],
      })
    );

    expect(text).toContain("Приостановленные офферы");
    expect(text).toContain("01. Вечерний набор | время паузы не хранится");
    expect(text).toContain("итого: 1 задач на сегодня");
    expect(text).not.toContain("Давно не проверялось");
    expect(text).not.toContain("Офферы за 7 дней");
  });
});
