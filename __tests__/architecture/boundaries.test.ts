/// <reference types="node" />

import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCAN_ROOT_DIRS = ["app", "components", "lib", "i18n"];
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  "src",
  ".worktrees",
  "ios",
  ".next",
  "dist",
]);
const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

const IMPORT_PATTERNS = [
  /from\s+['"]([^'"]+)['"]/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  /require\(\s*['"]([^'"]+)['"]\s*\)/g,
];

interface FileRecord {
  relativePath: string;
  targets: string[];
}

function collectSourceFiles(dirAbsolutePath: string, out: string[]): void {
  if (!fs.existsSync(dirAbsolutePath)) return;

  for (const entry of fs.readdirSync(dirAbsolutePath, { withFileTypes: true })) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;

    const entryPath = path.join(dirAbsolutePath, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(entryPath, out);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      out.push(entryPath);
    }
  }
}

function toRepoRelative(absolutePath: string): string {
  return path.relative(REPO_ROOT, absolutePath).split(path.sep).join("/");
}

function extractSpecifiers(source: string): string[] {
  const specifiers: string[] = [];

  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match = pattern.exec(source);
    while (match !== null) {
      specifiers.push(match[1]);
      match = pattern.exec(source);
    }
  }

  return specifiers;
}

function resolveSpecifier(specifier: string, fromAbsolutePath: string): string {
  if (specifier.startsWith("@/")) {
    return specifier.slice(2);
  }
  if (specifier.startsWith(".")) {
    const resolvedAbsolute = path.resolve(path.dirname(fromAbsolutePath), specifier);
    return toRepoRelative(resolvedAbsolute);
  }
  return specifier;
}

function loadFileRecords(): FileRecord[] {
  const absolutePaths: string[] = [];
  for (const dir of SCAN_ROOT_DIRS) {
    collectSourceFiles(path.join(REPO_ROOT, dir), absolutePaths);
  }

  return absolutePaths.map((absolutePath) => {
    const source = fs.readFileSync(absolutePath, "utf8");
    const rawSpecifiers = extractSpecifiers(source);
    return {
      relativePath: toRepoRelative(absolutePath),
      targets: rawSpecifiers.map((specifier) =>
        resolveSpecifier(specifier, absolutePath)
      ),
    };
  });
}

function isWithin(target: string, boundary: string): boolean {
  const normalized = boundary.replace(/\/$/, "");
  return target === normalized || target.startsWith(`${normalized}/`);
}

// Files that reach into @supabase/ or lib/supabase directly from outside
// lib/api. These predate the v2 boundary guard and are frozen here by name.
// Only lib/api may talk to Supabase directly for v2 code, new direct
// importers outside lib/api are not allowed to join this list.
const LEGACY_SUPABASE_IMPORTERS: readonly string[] = [
  "lib/marketplace-store.tsx",
  "lib/reservations.ts",
  "lib/seller/auth-store.tsx",
  "lib/seller/inventory-store.ts",
  "lib/seller/offers-store.ts",
  "lib/seller/orders-store.ts",
  "lib/seller/profile-store.ts",
];

function isSupabaseTarget(target: string): boolean {
  return isWithin(target, "@supabase") || isWithin(target, "lib/supabase");
}

function isSupabaseImportAllowed(relativePath: string): boolean {
  return (
    isWithin(relativePath, "lib/api") ||
    relativePath === "lib/supabase.ts" ||
    LEGACY_SUPABASE_IMPORTERS.includes(relativePath)
  );
}

// Pre-existing buyer and seller coupling that predates the v2 boundary
// guard. app/(tabs)/settings.tsx reads seller auth state from lib/seller
// to decide between the Switch to Seller and Seller Login labels. Removing
// this coupling is out of scope for the v2 boundary guard task, so it is
// frozen here by exact file and import target rather than left unguarded.
const LEGACY_CROSS_SURFACE_IMPORTS: readonly {
  file: string;
  targetPrefix: string;
}[] = [{ file: "app/(tabs)/settings.tsx", targetPrefix: "lib/seller" }];

function isCrossSurfaceImportAllowed(relativePath: string, target: string): boolean {
  return LEGACY_CROSS_SURFACE_IMPORTS.some(
    (entry) => entry.file === relativePath && isWithin(target, entry.targetPrefix)
  );
}

interface SurfaceRule {
  name: string;
  governedDirs: string[];
  forbiddenPrefixes: string[];
}

const BUYER_SURFACE_RULE: SurfaceRule = {
  name: "buyer surface must not import seller or supabase internals",
  governedDirs: ["app/(tabs)", "app/offer", "components/buyer", "lib/buyer"],
  forbiddenPrefixes: [
    "@supabase",
    "lib/supabase",
    "lib/seller",
    "components/seller",
    "app/(seller-tabs)",
  ],
};

const SELLER_SURFACE_RULE: SurfaceRule = {
  name: "seller surface must not import buyer or supabase internals",
  governedDirs: ["app/(seller-tabs)", "app/auth", "components/seller", "lib/seller"],
  forbiddenPrefixes: ["@supabase", "lib/buyer", "components/buyer", "app/(tabs)"],
};

function checkSurfaceRule(rule: SurfaceRule, files: FileRecord[]): string[] {
  const violations: string[] = [];

  for (const file of files) {
    const isGoverned = rule.governedDirs.some((dir) => isWithin(file.relativePath, dir));
    if (!isGoverned) continue;

    for (const target of file.targets) {
      const forbiddenPrefix = rule.forbiddenPrefixes.find((prefix) =>
        isWithin(target, prefix)
      );
      if (!forbiddenPrefix) continue;

      if (isSupabaseTarget(target) && isSupabaseImportAllowed(file.relativePath)) {
        continue;
      }
      if (isCrossSurfaceImportAllowed(file.relativePath, target)) {
        continue;
      }

      violations.push(
        `[${rule.name}] ${file.relativePath} imports '${target}' which crosses into '${forbiddenPrefix}'`
      );
    }
  }

  return violations;
}

function checkSupabaseRule(files: FileRecord[]): string[] {
  const violations: string[] = [];

  for (const file of files) {
    for (const target of file.targets) {
      if (!isSupabaseTarget(target)) continue;
      if (isSupabaseImportAllowed(file.relativePath)) continue;

      violations.push(
        `[direct supabase import] ${file.relativePath} imports '${target}' outside lib/api and the frozen legacy allowlist`
      );
    }
  }

  return violations;
}

function checkContractsIsolationRule(files: FileRecord[]): string[] {
  const violations: string[] = [];

  for (const file of files) {
    if (!isWithin(file.relativePath, "lib/contracts")) continue;

    for (const target of file.targets) {
      if (isWithin(target, "lib/contracts")) continue;

      violations.push(
        `[lib/contracts isolation] ${file.relativePath} imports '${target}' from outside lib/contracts`
      );
    }
  }

  return violations;
}

function reportAndAssertEmpty(violations: string[]): void {
  if (violations.length > 0) {
    console.log(violations.join("\n"));
  }
  expect(violations).toEqual([]);
}

describe("architecture boundaries", () => {
  const files = loadFileRecords();

  it("keeps the buyer surface free of seller and supabase internals", () => {
    reportAndAssertEmpty(checkSurfaceRule(BUYER_SURFACE_RULE, files));
  });

  it("keeps the seller surface free of buyer and supabase internals", () => {
    reportAndAssertEmpty(checkSurfaceRule(SELLER_SURFACE_RULE, files));
  });

  it("restricts direct supabase imports to lib/api and the frozen legacy allowlist", () => {
    reportAndAssertEmpty(checkSupabaseRule(files));
  });

  it("keeps lib/contracts free of imports from outside lib/contracts", () => {
    reportAndAssertEmpty(checkContractsIsolationRule(files));
  });
});
