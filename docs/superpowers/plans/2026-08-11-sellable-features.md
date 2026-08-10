# Overnight Run 2: Sellable Features Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Maximum practical, sellable features by morning, portfolio co-set with the Oracle consultation, everything gated by tests against the real local stack.

**Architecture:** Extends the shipped beta foundation (see docs/beta/CONTRACT_HANDOFF_NOTES.md). Same rules as run 1: additive migrations, RPCs with the claim-step idempotency pattern and code-prefix errors, facade plus fake plus conformance parity, seller UI behind the store flag gate, TDD, path-scoped commits, review gate per task.

**Tech Stack:** unchanged (Expo 55, RN 0.83, Supabase local, jest).

## Global Constraints

- Everything from run 1 stands: error prefixes, idempotency scoping, RLS posture, no client writes, honest states, EN plus RU strings (RU primary per founder), no em-dashes or semicolons in markdown and comments, never git add -A, backend tasks own the stack exclusively one at a time.
- No new npm dependencies. No payments, no fiscal writes, no camera model work (Wizard-of-Oz manual entry only).
- Every feature ships with: contract change if any (facade plus fake plus conformance), migration plus backend tests when SQL, seller or operator UI with component tests, one line in the sprint pitch doc.

---

### Task A: Exception resolve command

**Files:** supabase/migrations (additive), lib/contracts/seller.ts (ResolveStoreExceptionV2Input), lib/api (facade method plus supabase impl), lib/test-kit (fake plus conformance), app/(seller-tabs) exceptions surface addition, __tests__/**

Backend: resolve_store_exception_v2(p_store_id, p_exception_id, p_resolution_note, p_idempotency_key), manager or owner, open to resolved, releases the mismatch encumbrance (failed_stock_mismatch reservations of the related offer stop counting as allocated once the exception is resolved), audit plus outbox, claim-step idempotency, version-free (exception has no version, idempotent by key plus fingerprint exception_id). Seller UI: exceptions list gains resolve action with required note, honest copy replacing the operator-database line. Update mismatch guidance strings to name the new path. Tests all levels including publish-ceiling regains capacity after resolve.

### Task G: Showroom demo page

**Files:** docs/showroom/index.html (single file, self-contained)

Three sample shops per the strategy doc: no-POS verified-offer shop, partial-POS systematization shop, camera research lab (clearly labeled демо and исследование). Minimal Yandex-Go style per docs/brand/ (reuse palette, fonts, verified chip, ticket). All Russian. Live-feel tiles with staged data, the honest checkout scene as an animated sequence (возможное изъятие, оплата неизвестна, менеджер утверждает, баланс 7 к 6). No backend, pure static demo asset for pitches.

### Task B: Canonical CSV import (ticket 9)

**Files:** supabase/migrations (import_batches, staged_source_records, aliases per SHARED_CONTEXT Core Domain), contracts (ImportBatchV2, StagedRecordV2, facade methods uploadImportBatchV2 as parsed-rows submission, listStagedRecordsV2, approveStagedRecordV2, rejectStagedRecordV2), fake plus conformance, seller or operator UI screen (staged review list with match candidates, approve or reject), CSV golden-file tests (fixtures with messy real-world rows, encodings, duplicate barcodes, ambiguous matches stay unresolved).

Matching: source id, barcode, approved aliases. Approved records create products or observations (append-only). Ambiguity never auto-merges.

### Task D: Expiry watchlist plus markdown suggestions

**Files:** migration (view or RPC list_expiry_watchlist_v2), contracts plus facade plus fake, seller screen (watchlist sorted by days-to-expiry, deterministic suggestion chips: снять с полки today, уценка X% from the deterministic table in EXPERIMENT_BACKLOG), tests.

### Task C: Owner digest composer

**Files:** migration (RPC compose_owner_digest_v2 returning structured jsonb: dead stock, expiry risks, open exceptions, mismatch rate, count compliance, offers performance), contracts plus facade plus fake, scripts/send-owner-digest.ts (formats Telegram-ready RU text, prints to stdout, optional TELEGRAM_BOT_TOKEN env send, never required), seller dashboard digest card, tests.

### Task F: Sprint operator toolkit

**Files:** docs/sprint/SPRINT_PLAYBOOK.md (RU, the 7-10 day checklist), docs/sprint/intake-form.html (static RU form printing a filled brief), scripts/sprint-report.ts (before and after report from the digest RPC), tests for the script.

### Task H: Video Wizard-of-Oz kit

**Files:** extends count session: count_sessions gains source text default manual check in (manual, video_assisted), seller count UI gains a source toggle, operator doc docs/sprint/VIDEO_SHOOTOUT_PROTOCOL.md (RU, the 100-SKU comparison protocol with the 25% gate and zero-silent-merge rule), tests.

### Task E: Operator reliability console (stretch)

**Files:** read-model RPC store_reliability_v2 (staleness, closeout compliance, mismatch rate), minimal operator screen or doc-only SQL views if time runs short.

---

Verification per task: full trio plus npm run test:backend plus db reset clean. Final: whole-run review, Codex audit, morning report docs/beta/OVERNIGHT_RUN_2026-08-11.md (Russian).
