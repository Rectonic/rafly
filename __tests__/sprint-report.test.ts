import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

describe("formatSprintReport", () => {
  it("compares catalog snapshots and reports sprint activity deltas", () => {
    const reportModule = pathToFileURL(
      join(process.cwd(), "scripts", "sprint-report.mjs")
    ).href;
    const beforePath = join(
      process.cwd(),
      "__tests__",
      "fixtures",
      "sprint-report-before.json"
    );
    const afterPath = join(
      process.cwd(),
      "__tests__",
      "fixtures",
      "sprint-report-after.json"
    );
    const runner = `
      import { readFileSync } from "node:fs";
      import { formatSprintReport } from ${JSON.stringify(reportModule)};

      const before = JSON.parse(readFileSync(process.argv[1], "utf8"));
      const after = JSON.parse(readFileSync(process.argv[2], "utf8"));
      process.stdout.write(formatSprintReport(
        before,
        after,
        new Date("2026-08-11T00:00:00+05:00")
      ));
    `;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "--eval", runner, beforePath, afterPath],
      { encoding: "utf8" }
    );

    if (result.status !== 0) {
      throw new Error(result.stderr);
    }

    expect(result.stdout).toBe(
      [
        "Отчёт Store Control Sprint",
        "",
        "Каталог: было 24 позиций без штрихкода, стало 3.",
        "Просрочка: снято 7 позиций на сумму 186 500 сум.",
        "Исключения: закрыто 9.",
        "Офферы: опубликовано 6, выполнено 4.",
        "",
        "Данные внесены оператором спринта вручную. Дата: 11.08.2026. Источник: не система."
      ].join("\n")
    );
  });
});
