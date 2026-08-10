const EXCEPTION_LABELS = {
  stock_mismatch: "расхождение стока",
  import_conflict: "конфликт импорта",
  expiry_risk: "риск срока годности",
  closeout_missed: "пропущено закрытие дня",
};

function formatNumber(value) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

function formatDate(value) {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
}

function formatDateTime(value) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");
  const minute = String(date.getUTCMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hour}:${minute} UTC`;
}

function numbered(lines) {
  return lines.map(
    (line, index) => `${String(index + 1).padStart(2, "0")}. ${line}`
  );
}

function appendSection(output, title, lines) {
  if (lines.length === 0) return;
  output.push("", title, ...lines);
}

function formatDigestRu(digest) {
  const output = [
    `Сводка дня: ${digest.storeName}`,
    `Сформировано: ${formatDateTime(digest.generatedAt)}`,
  ];

  appendSection(
    output,
    "Давно не проверялось",
    numbered(
      digest.staleVerification.map((item) => {
        const verified = item.lastVerifiedAt
          ? `проверено ${formatDateTime(item.lastVerifiedAt)}`
          : "не проверялось";
        return `${item.productName} | остаток ${formatNumber(item.onHand)} | ${verified}`;
      })
    )
  );
  appendSection(
    output,
    "Срок годности до 3 дней",
    numbered(
      digest.expiryRisk.map(
        (item) =>
          `${item.productName} | ${formatDate(item.expiryDate)} | ${formatNumber(item.daysToExpiry)} дн. | остаток ${formatNumber(item.onHand)}`
      )
    )
  );
  appendSection(
    output,
    "Открытые исключения",
    numbered(
      digest.openExceptions.map(
        (item) =>
          `${EXCEPTION_LABELS[item.kind] ?? item.kind} | ${item.message} | ${formatDateTime(item.createdAt)}`
      )
    )
  );
  appendSection(
    output,
    "Приостановленные офферы",
    numbered(
      digest.pausedOffers.map(
        (item) => `${item.title} | время паузы не хранится`
      )
    )
  );

  if (digest.countActivity7d.daysWithCountSession > 0) {
    appendSection(output, "Пересчёты за 7 дней", [
      `дней с пересчётом: ${formatNumber(digest.countActivity7d.daysWithCountSession)} из ${formatNumber(digest.countActivity7d.days)}`,
    ]);
  }

  const offerMetrics = digest.offers7d;
  if (Object.values(offerMetrics).some((value) => value > 0)) {
    appendSection(output, "Офферы за 7 дней", [
      `опубликовано: ${formatNumber(offerMetrics.published)}`,
      `выдано: ${formatNumber(offerMetrics.fulfilled)}`,
      `отменено продавцом: ${formatNumber(offerMetrics.cancelledBySeller)}`,
      `неявка: ${formatNumber(offerMetrics.expiredNoShow)}`,
      `не хватило стока: ${formatNumber(offerMetrics.failedStockMismatch)}`,
    ]);
  }

  const taskCount =
    digest.staleVerification.length +
    digest.expiryRisk.length +
    digest.openExceptions.length +
    digest.pausedOffers.length;
  output.push("", `итого: ${formatNumber(taskCount)} задач на сегодня`);
  return output.join("\n");
}

module.exports = { formatDigestRu };
