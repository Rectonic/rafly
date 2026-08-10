import type {
  DecideStagedRecordV2Input,
  ImportBatchV2,
  StagedSourceRecordV2,
  UploadImportBatchV2Input,
} from "@/lib/contracts";

describe("seller import contracts", () => {
  it("exposes upload and staged review shapes without record versions", () => {
    const batch = {
      id: "batch-1",
      storeId: "store-1",
      filename: "inventory.csv",
      status: "needs_review",
      totalRecords: 2,
      pendingRecords: 1,
      createdAt: "2026-08-11T10:00:00.000Z",
    } satisfies ImportBatchV2;
    const stagedRecord = {
      id: "record-1",
      batchId: "batch-1",
      storeId: "store-1",
      rawName: "Bread",
      rawBarcode: null,
      rawQuantity: 3,
      rawPrice: null,
      matchStatus: "ambiguous",
      matchedStoreProductId: null,
      candidates: [
        {
          storeProductId: "product-1",
          productName: "Country bread",
          reason: "Same barcode",
        },
      ],
      createdAt: "2026-08-11T10:00:00.000Z",
    } satisfies StagedSourceRecordV2;
    const upload = {
      storeId: "store-1",
      filename: "inventory.csv",
      records: [{ rawName: "Bread", rawQuantity: 3 }],
      idempotencyKey: "upload-1",
    } satisfies UploadImportBatchV2Input;
    const decision = {
      storeId: "store-1",
      recordId: "record-1",
      decision: "approve",
      targetStoreProductId: "product-1",
      idempotencyKey: "decision-1",
    } satisfies DecideStagedRecordV2Input;

    expect({ batch, stagedRecord, upload, decision }).toBeDefined();
  });
});
