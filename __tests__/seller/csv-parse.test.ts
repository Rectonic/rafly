import { readFileSync } from "node:fs";
import { join } from "node:path";

import { parseSellerCsv } from "@/lib/seller/csv-parse";

const readFixture = (filename: string) =>
  readFileSync(join(process.cwd(), "__tests__/fixtures/csv", filename), "utf8");

describe("parseSellerCsv", () => {
  it("parses a clean comma-delimited file into upload-ready records", () => {
    expect(parseSellerCsv(readFixture("clean.csv"))).toEqual({
      ok: true,
      records: [
        {
          rawName: "Sourdough loaf",
          rawBarcode: "4601234567890",
          rawQuantity: 12,
          rawPrice: 18500,
        },
        {
          rawName: "Croissant",
          rawBarcode: "4601234567891",
          rawQuantity: 4,
          rawPrice: 12000,
        },
      ],
    });
  });

  it("parses BOM-prefixed Russian headers, quoted values, and empty cells", () => {
    expect(parseSellerCsv(readFixture("messy-real.csv"))).toEqual({
      ok: true,
      records: [
        {
          rawName: "Хлеб, ржаной",
          rawBarcode: "4601234567890",
          rawQuantity: 3,
          rawPrice: 18500.5,
        },
        {
          rawName: 'Салат "Оливье"; семейный',
          rawBarcode: "4601234567890",
          rawQuantity: 2,
        },
        {
          rawName: "Булочка с маком",
          rawPrice: 7500,
        },
      ],
    });
  });

  it("returns a renderable error when the name header is missing", () => {
    expect(parseSellerCsv("Barcode,Quantity\n4601234567890,3")).toEqual({
      ok: false,
      error: {
        code: "missing_name_header",
        message: "A name header is required",
      },
    });
  });

  it("identifies the row and column with a malformed numeric cell", () => {
    expect(parseSellerCsv("Name,Quantity,Price\nBread,three,18000")).toEqual({
      ok: false,
      error: {
        code: "invalid_numeric_cell",
        message: "The quantity cell must contain a nonnegative integer",
        column: "quantity",
        row: 2,
      },
    });
  });

  it("rejects a data row whose trimmed name is empty", () => {
    expect(parseSellerCsv("Name,Quantity\n   ,3")).toEqual({
      ok: false,
      error: {
        code: "missing_name_cell",
        message: "The name cell is required",
        row: 2,
      },
    });
  });

  it("rejects a negative quantity", () => {
    expect(parseSellerCsv("Name,Quantity\nFlour,-1")).toEqual({
      ok: false,
      error: {
        code: "invalid_numeric_cell",
        message: "The quantity cell must contain a nonnegative integer",
        column: "quantity",
        row: 2,
      },
    });
  });

  it("rejects a negative price", () => {
    expect(parseSellerCsv("Name,Price\nFlour,-0.5")).toEqual({
      ok: false,
      error: {
        code: "invalid_numeric_cell",
        message: "The price cell must contain a nonnegative number",
        column: "price",
        row: 2,
      },
    });
  });

  it("rejects a fractional quantity", () => {
    expect(parseSellerCsv("Name,Quantity\nFlour,1.234")).toEqual({
      ok: false,
      error: {
        code: "invalid_numeric_cell",
        message: "The quantity cell must contain a nonnegative integer",
        column: "quantity",
        row: 2,
      },
    });
  });

  it("rejects a quantity above the backend integer range", () => {
    expect(parseSellerCsv("Name,Quantity\nFlour,2147483648")).toEqual({
      ok: false,
      error: {
        code: "invalid_numeric_cell",
        message: "The quantity cell must contain a nonnegative integer",
        column: "quantity",
        row: 2,
      },
    });
  });

  it("keeps a dot value with three fractional digits as a price", () => {
    expect(parseSellerCsv("Name,Price\nFlour,1.234")).toEqual({
      ok: true,
      records: [{ rawName: "Flour", rawPrice: 1.234 }],
    });
  });

  it("keeps a comma value with three fractional digits as a price", () => {
    expect(parseSellerCsv("Name;Price\nSugar;0,125")).toEqual({
      ok: true,
      records: [{ rawName: "Sugar", rawPrice: 0.125 }],
    });
  });

  it("normalizes fixed headers without consulting the runtime locale", () => {
    const localeLowerCase = jest
      .spyOn(String.prototype, "toLocaleLowerCase")
      .mockReturnValue("locale-dependent-header");

    try {
      expect(parseSellerCsv("Name,Price\nFlour,1.25")).toEqual({
        ok: true,
        records: [{ rawName: "Flour", rawPrice: 1.25 }],
      });
      expect(localeLowerCase).not.toHaveBeenCalled();
    } finally {
      localeLowerCase.mockRestore();
    }
  });

  it("preserves every duplicate row from the duplicate fixture", () => {
    expect(parseSellerCsv(readFixture("dupes.csv"))).toEqual({
      ok: true,
      records: [
        {
          rawName: "Cheese bun",
          rawBarcode: "4601234567000",
          rawQuantity: 2,
          rawPrice: 9000,
        },
        {
          rawName: "Cheese bun",
          rawBarcode: "4601234567000",
          rawQuantity: 2,
          rawPrice: 9000,
        },
        {
          rawName: "Cheese bun",
          rawBarcode: "4601234567000",
          rawQuantity: 2,
          rawPrice: 9000,
        },
      ],
    });
  });

  it("returns a renderable error for an unclosed quoted field", () => {
    expect(parseSellerCsv("Name,Quantity\n\"Bread,3")).toEqual({
      ok: false,
      error: {
        code: "malformed_csv",
        message: "The CSV contains an unclosed or misplaced quote",
      },
    });
  });

  it("returns a renderable error for text after a closing quote", () => {
    expect(parseSellerCsv("Name,Quantity\n\"Bread\"x,3")).toEqual({
      ok: false,
      error: {
        code: "malformed_csv",
        message: "The CSV contains an unclosed or misplaced quote",
      },
    });
  });
});
