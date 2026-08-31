---
artifact_contract: "ce-handoff/v1"
created_at: "2026-08-31T10:10:00Z"
title: "Rafly submission package, research verification handoff"
summary: "Hands a verifier the whole President Tech Award package and sorts every externally checkable claim into verified, provenance-only, and never-checked."
keywords: ["rafly", "research-verification", "fact-check", "president-tech-award", "market-model", "claims-audit", "uzbekistan-retail"]
cwd: "/Users/boiskhonkattakhodjaev/Desktop/Useful Materials/LastBite/lastbite-mobile"
resume_focus: "Independently verify the research and every externally checkable claim across the whole docs/pta and docs/brand package: sourced market figures, the financial model CSV, engineering counts, award facts, traction, product capability claims, competitor claims, and cross-document consistency."
repository: "github.com/Rectonic/LastBite"
repo_root_sha: "a38d4850fc24216aee96b9a09f82a829236b7b32"
branch: "dev"
head: "36a22b7080041c609fb7e550472e43d1d66df438"
---

# Rafly submission package, research verification handoff

Third writing of this handoff. Two earlier copies in this same managed store were deleted by OS cleanup of `/tmp` within the hour, so treat this store as volatile and copy this file somewhere durable if verification will not start immediately. Content re-checked at creation: no file under `docs/pta` or `docs/brand` has changed since 13:43 local on 2026-08-31, and no background worker is running, so the package described here is stable.

## What the package is

A President Tech Award 2026 submission for a product renamed **LastBite to Rafly** on 2026-08-31. Track: Лучший стартап-проект. Chosen category: Корпоративные решения, fallback Логистика и мобильность. About 40 files under `docs/pta/` and `docs/brand/`, built in one session by parallel Codex workers under a Fable coordinator.

Everything named here is **uncommitted working-tree state**. `HEAD` is `36a22b7` and none of `docs/pta` exists at it. `git show` will not find these files, read them from the working tree.

## The two founder directives that shaped every claim

Both matter because they explain why the text says what it says.

1. **Tone was reversed mid-session.** The material was first written under an instruction to present conservatively and print zero counters. The founder cancelled that with an explicit sell-first directive. Three rewrite workers then reworked the deck, the application answers and the collateral. Their brief said change framing only, leave arithmetic, citations and the CSV untouched. **Nobody confirmed they honoured that**, and no pre-rewrite state was committed, so no diff exists.
2. **The founder asserted traction.** Agreements with 50 shops, launching now, pilot scope stock monitoring and stock analytics, works with any POS or none, fast full inventory, turnkey launch support, registered legal entity. This is the load-bearing claim of the whole package and **it was never verified**: no agreement, contract, shop list or registration document was seen by the coordinator.

The founder also asked for the claim "подключаемся к любым POS-системам". The coordinator declined to write that as shipped capability because the codebase has no POS connectors, and phrased it as a service outcome instead, the sprint extracting whatever the shop has. That was the coordinator's call and the founder was told. A verifier should judge whether the current wording still overpromises.

## Claim classes, sorted by what is actually known

### A. Verified first-hand during the session

Only one external data source in the whole package.

`docs/pta/MARKET_AND_MODEL_RU.md` l.28 cites the State Statistics Committee of Uzbekistan, SIAT indicator 1.07.02.0030, 2024, giving 227,910 retail trade organisations for the republic and 40,619 for Tashkent. Fetched `https://siat.stat.uz/data/2707/?lang=ru` on 2026-08-31: both numbers matched exactly, 2024 is the latest year in the series.

Award facts were read directly off `https://awards.gov.uz/ru/pta/best-startup-project` the same day: four participation criteria (Seed or Series A, users and sales, revenue or signed commercial contracts, team of 3 to 8), prizes 125,000 / 75,000 / 50,000 USD, fund 2,500,000 USD, ten categories, top five per category to the final, screening 01.09-25.09, bootcamp 10.12-17.12, final 23.12, OneID login, Uzbek citizens only, registered legal entity required for this track. The page counter said applications close 01.09.2026 while the stage table said registration 01.07-31.08. **That date contradiction is unresolved** and is flagged in `docs/pta/SUBMISSION_CHECKLIST_RU.md` l.5.

### B. Provenance chain only, not re-measured

The engineering counts appear about 25 times across the package: 195 backend integration tests, 693 frontend tests, 292 localisation keys at parity, 11 migrations, strict typecheck and lint clean, clean db reset.

Provenance: measured during the 2026-08-11 run, recorded in `docs/beta/OVERNIGHT_RUN_2026-08-11.md` l.11-12 and l.48, at commit `fc22a1a`. `fc22a1a` is still the newest commit touching `lib`, `app`, `components`, `supabase` or `__tests__`, so no code commit landed after the measurement.

Missing: **no suite was run in the submission session**, and a working-tree diff over the code directories timed out at five minutes on this filesystem and never completed. So the claim is "true as of the last measured commit with no code commit since", not "true now". Re-run before these numbers go to a jury.

Where they appear: `docs/pta/one-pager-ru.html` and `-en.html` status blocks, `docs/pta/PRESS_KIT_RU.md`, `docs/pta/APPLICATION_ANSWERS_RU.md` метрики section, deck slide 7.

### C. Founder-stated, never verified

The 50-shop cohort and everything hanging off it. Appears seven times in the Russian deck alone, twice with the attribution "Источник: соглашения с 50 магазинами, подтверждено основателем 31.08.2026". Honest about provenance, still unverified, and carried into a government application. Also unverified: the legal entity, the pilot scope, the turnkey claim, POS independence in practice.

### D. Assumption-built, correctly labelled, load-bearing

`docs/pta/MARKET_AND_MODEL_RU.md` labels every number Источник, Расчёт or Допущение. Treat any unlabelled number as a defect. Seventeen Источник strings exist but most are the label definition or internal cross-references. **In practice the package rests on one external source.**

Riskiest chains:

- TAM and SAM at l.63-l.80 multiply three independent share guesses against the official count, e.g. `227 910 × 25% × 70% × 50% = 19 942`. Compounding three guesses is the structural weak point.
- The problem-in-money section at l.94 builds a per-shop monthly loss purely from assumptions, and that figure then justifies the subscription price at l.107. Wrong input propagates into the pricing story.
- GMV per active marketplace shop and the take rate are unmeasured and drive much of recurring revenue.

### E. Never opened or executed

`docs/pta/financial-model.csv`, 24 data rows. **Not a values file**: most columns are Excel formula strings such as `=H2*I2*J2`. Self-check columns `capacity_check`, `cash_rollforward_check`, `row_status` were written by the same worker that wrote the model, their truth unknown. Nobody opened it in a spreadsheet. Nobody reconciled it against the headline outputs asserted in `docs/pta/ASSUMPTIONS_REGISTER_RU.md` l.5: closing cash 406.6 million UZS, 346.7 active shops, period revenue 2,305.9 million UZS, month-24 net cash flow 25.4 million UZS. **Single highest-value unrun check in the package.**

### F. Competitor claims

Deliberately thin. `docs/pta/JURY_QA_RU.md` section 14 answers copyability. `docs/pta/APPLICATION_ANSWERS_RU.md` tells the founder to re-check any competitor's current features before naming one. No competitor named by brand anywhere, because the incoming Too Good To Go style entrant could not be publicly confirmed. Verifier should judge whether an unnamed competitor weakens differentiation.

### G. Name checks, dated 2026-08-31

LastBite, then Stokly, then Rafly in one day. Stokly dropped because `stok.ly` is an active British retail stock-control ERP in exactly this category. Rafly chosen after DNS checks: rafly.uz, rafly.app, rafly.co free, rafly.com resolving but serving nothing. Stoqa rejected, Saudi fintech with a Google Play app `ai.stoqa.app`. **DNS and web-search checks only, no trademark registry consulted anywhere.**

## Mechanical checks already passed, do not repeat

- No residual dead brand names. The only LastBite hits are a filesystem path in `docs/pta/film/RECORDING_GUIDE_RU.md` l.21 and guard strings in `docs/pta/verify-media-kit.py` l.48 and l.78, both correct.
- Zero external network references in any HTML, everything opens offline.
- Print rules present in both one-pagers, the Russian deck, the brand book.
- All nine SVGs in `docs/brand/logo/` parse as XML with a viewBox.
- Both decks carry category Корпоративные решения and 17 slides each.
- No text from the cancelled conservative stance survives, checked by regex sweep.
- The film `docs/pta/film/index.html` computes to exactly 103,000 ms across 13 scenes, no gaps, 15 subtitle cues, no blur filters on moving elements, and it was watched playing through in a browser.

One open item on the film: whether its virtual camera actually translates during playback. DOM sampling was inconclusive and the worker that built it could not watch it, its environment blocked `file://`. One human 1920x1080 watch-through recommended before recording.

## Cross-document consistency, unchecked

About forty files by eight workers plus coordinator edits. Nobody checked the same fact reads identically everywhere. Likely drift points: the subscription price (model, deck, one-pagers, application answers), sprint length 7-10 days (nearly every file), use-of-funds split (deck tranche slide vs application answers), category wording (corrected twice by different hands).

## Suggested verification path

One sequence, each step feeds the next.

1. Establish whether the 50-shop cohort is documented. Everything else is weighted by that answer.
2. Open the CSV in a spreadsheet, read `row_status` down all 24 rows, reconcile evaluated outputs against the four headline figures in the assumptions register.
3. Re-derive TAM, SAM, SOM by hand from `MARKET_AND_MODEL_RU.md` l.63-l.92.
4. Re-run the test suites, confirm or correct 195, 693, 292, 11.
5. Sweep for cross-document contradictions on price, sprint length, use of funds, category.
6. Judge the POS wording and the unnamed-competitor choice.

## Fragile local state

- **Machine-local:** the working tree at `/Users/boiskhonkattakhodjaev/Desktop/Useful Materials/LastBite/lastbite-mobile` holds every artifact, uncommitted. Losing the tree loses the package. Nothing under `docs/pta` exists at any commit.
- The filesystem is iCloud-backed and slow: `git status`, `git fetch`, scoped `git diff` over code dirs all time out at five minutes. Use `git --no-pager rev-parse` and `git --no-pager log -1 -- <path>` instead.
- Worker prompts and shared context live in `.superpowers/sdd/2026-08-31-pta-submission/`, gitignored, machine-local. `SHARED_CONTEXT.md` there explains why the material says what it says: tone reversal in its section 3, traction facts in section 4.
- **This managed store is volatile**, two prior handoffs here were wiped by OS `/tmp` cleanup within an hour of writing.

---

## Результаты верификации, 31.08.2026, вечерняя сессия

Проверено и закрыто:

1. Противоречие дат решено. Живой счётчик на awards.gov.uz показывал 13 часов 43 минуты до закрытия, формулировка дословно «Приём заявок завершится 01.09.2026». Таблица этапов 01.07–31.08 устарела, счётчик авторитетен. Дедлайн: ночь на 01.09.
2. financial-model.csv исполнен полностью (все 52 колонки, 24 строки, вычислитель формул). Все четыре контрольные цифры сошлись точно: closing cash 406 577 013.51 UZS, active shops 346.7, суммарная выручка периода 2 305.9 млн UZS, чистый поток месяца 24 равен 25 446 795.64 UZS. Колонки capacity_check и cash_rollforward_check истинны во всех строках, row_status везде 1.
3. Сквозная согласованность: спринт «7-10 дней» (26 вхождений, дрейфа нет), цена спринта 1 500 000 и подписка 500 000 согласованы во всех файлах, категория «Корпоративные решения» и транши 35/35/30 без расхождений.
4. Статические инженерные цифры: миграций ровно 11, паритет ключей локализации RU=EN подтверждён (372=372 по прямому подсчёту, заявленные 292 считались другой методикой, к жюри выносить только после пересчёта). Тесты 195/693 не перегонялись, остаются «на коммит fc22a1a».
5. verify-media-kit.py обновлён под sell-first рамку (убраны требования SWAP LOGO и фразы «первый пилот не начался») и теперь проходит: 8 деливераблов зелёные.

Исправлено в материалах:

1. Дек RU и EN: svg text fill:currentColor больше не гасит явные цвета (слайд 05, невидимый Rafly Market, починен), подсказка навигации видима на светлых слайдах, разрывы чисел в RU убраны узкими неразрывными пробелами, слайд 14 без колонки в одно слово, мокапы слайда 07 без обрезки текста, кнопка «Открыть сводку дня», таймлайны отцентрованы.
2. Фильм: вывески сцен 2 и 7 подняты над панелями (наложений нет), шрифтовой стек заголовков без Arial Rounded MT Bold (кириллица), подписи плиток сроков влезают в плитки. Скраб и сцены проверены скриншотами.
3. Демо: логотип-буква S (артефакт Stokly) заменён на R в двух местах.
4. Новый файл film/GENVIDEO_SCENARIO_RU.md: полный производственный сценарий генеративного фильма по решению основателя (13 сцен, стиль-библия, промпты, конвейер, стоп-правила).

Осталось только основателю, до сабмита:

1. Слайд 15 команды и слайд 17 контактов в обоих деках: плейсхолдеры. Аналогично контакты в лендинге и one-pager.
2. Кохорта 50 магазинов, юрлицо, скоуп пилота: подтверждены только словом основателя, документов никто не видел.
3. Всё дерево не закоммичено. Рекомендован немедленный git add docs/ и коммит.
