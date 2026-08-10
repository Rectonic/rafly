import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function formatSprintReport(before, after, generatedAt = new Date()) {
  const removedItems = after.expiry.removedItems - before.expiry.removedItems;
  const removedValueUzs =
    after.expiry.removedValueUzs - before.expiry.removedValueUzs;
  const closedExceptions = after.exceptions.closed - before.exceptions.closed;
  const publishedOffers = after.offers.published - before.offers.published;
  const fulfilledOffers = after.offers.fulfilled - before.offers.fulfilled;
  const formattedRemovedValue = String(removedValueUzs).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    " "
  );
  const reportDate = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Tashkent"
  }).format(generatedAt);

  return [
    "Отчёт Store Control Sprint",
    "",
    `Каталог: было ${before.catalog.itemsWithoutBarcode} позиций без штрихкода, стало ${after.catalog.itemsWithoutBarcode}.`,
    `Просрочка: снято ${removedItems} позиций на сумму ${formattedRemovedValue} сум.`,
    `Исключения: закрыто ${closedExceptions}.`,
    `Офферы: опубликовано ${publishedOffers}, выполнено ${fulfilledOffers}.`,
    "",
    `Данные внесены оператором спринта вручную. Дата: ${reportDate}. Источник: не система.`
  ].join("\n");
}

const isDirectRun =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const [beforePath, afterPath] = process.argv.slice(2);

  if (!beforePath || !afterPath) {
    process.stderr.write(
      "Использование: node scripts/sprint-report.mjs before.json after.json\n"
    );
    process.exitCode = 1;
  } else {
    try {
      const [beforeRaw, afterRaw] = await Promise.all([
        readFile(resolve(beforePath), "utf8"),
        readFile(resolve(afterPath), "utf8")
      ]);
      const before = JSON.parse(beforeRaw);
      const after = JSON.parse(afterRaw);

      process.stdout.write(`${formatSprintReport(before, after)}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`Не удалось сформировать отчёт: ${message}\n`);
      process.exitCode = 1;
    }
  }
}
