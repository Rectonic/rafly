/* eslint-disable @typescript-eslint/no-require-imports */
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React, { type ReactNode } from "react";

import ImportV2Screen from "@/app/(seller-tabs)/import-v2";
import InventoryV2Screen from "@/app/(seller-tabs)/inventory-v2";
import { ApiProvider, type SellerStoreApiV2 } from "@/lib/api";
import { InMemoryStoreCore, makeDefaultScenario } from "@/lib/test-kit";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/components/ScreenScrollView", () => {
  const ReactMock = require("react");
  const { ScrollView } = require("react-native");
  return {
    ScreenScrollView: ({ children, ...props }: { children: ReactNode }) =>
      ReactMock.createElement(ScrollView, props, children),
  };
});

jest.mock("@/lib/locale-store", () => ({
  useLocale: () => "ru",
  useSetLocale: () => jest.fn(),
}));

function makeWorld() {
  const core = new InMemoryStoreCore();
  const scenario = makeDefaultScenario(core);
  return { core, scenario };
}

function providerTree(sellerApi: SellerStoreApiV2, children: ReactNode) {
  return (
    <ApiProvider buyerApi={{} as never} sellerApi={sellerApi}>
      {children}
    </ApiProvider>
  );
}

type ImportTransportMethod =
  | "decideStagedRecordV2"
  | "listImportBatchesV2"
  | "listStagedRecordsV2"
  | "uploadImportBatchV2";

type ImportTransportEvent = {
  call: number;
  input: unknown;
  method: ImportTransportMethod;
};

type ImportTransportControls = {
  before?: (event: ImportTransportEvent) => Promise<void> | void;
  fail?: (event: ImportTransportEvent) => string | null;
  observe?: (event: ImportTransportEvent) => void;
};

function withImportTransport(
  realApi: SellerStoreApiV2,
  controls: ImportTransportControls
): SellerStoreApiV2 {
  const calls = new Map<ImportTransportMethod, number>();
  const prepare = async (method: ImportTransportMethod, input: unknown) => {
    const call = (calls.get(method) ?? 0) + 1;
    calls.set(method, call);
    const event = { call, input, method };
    controls.observe?.(event);
    await controls.before?.(event);
    const failureMessage = controls.fail?.(event) ?? null;
    return failureMessage
      ? {
          error: { code: "network_error" as const, message: failureMessage, retryable: true },
          ok: false as const,
        }
      : null;
  };

  return {
    ...realApi,
    decideStagedRecordV2: async (input) => {
      const failure = await prepare("decideStagedRecordV2", input);
      return failure ?? realApi.decideStagedRecordV2(input);
    },
    listImportBatchesV2: async (storeId) => {
      const failure = await prepare("listImportBatchesV2", { storeId });
      return failure ?? realApi.listImportBatchesV2(storeId);
    },
    listStagedRecordsV2: async (storeId, batchId) => {
      const failure = await prepare("listStagedRecordsV2", { batchId, storeId });
      return failure ?? realApi.listStagedRecordsV2(storeId, batchId);
    },
    uploadImportBatchV2: async (input) => {
      const failure = await prepare("uploadImportBatchV2", input);
      return failure ?? realApi.uploadImportBatchV2(input);
    },
  };
}

describe("ImportV2Screen", () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it("stays behind the shared access gate when no API provider is available", () => {
    const screen = render(<ImportV2Screen />);

    expect(screen.getByTestId("import-v2-access-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("import-v2-csv-input")).toBeNull();
  });

  it("parses pasted CSV and previews its rows with Russian seller copy", async () => {
    const { core, scenario } = makeWorld();
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.managerUserId }), <ImportV2Screen />)
    );

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    expect(screen.getByText("Импорт CSV")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("import-v2-filename-input"), "stock.csv");
    fireEvent.changeText(
      screen.getByTestId("import-v2-csv-input"),
      "Name,Barcode,Quantity,Price\nFresh bread loaf,4780000000011,12,18500\nTea,,3,9000"
    );
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));

    expect(screen.getByTestId("import-v2-preview-row-0")).toBeTruthy();
    expect(screen.getByText("Fresh bread loaf")).toBeTruthy();
    expect(screen.getByText("Tea")).toBeTruthy();
    expect(screen.getByText("Найдено строк: 2")).toBeTruthy();
  });

  it("caps the visible preview at 20 rows and says that more rows will upload", async () => {
    const { core, scenario } = makeWorld();
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.managerUserId }), <ImportV2Screen />)
    );
    const rows = Array.from({ length: 21 }, (_, index) => `Product ${index + 1},${index + 1}`);

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("import-v2-csv-input"), `Name,Quantity\n${rows.join("\n")}`);
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));

    expect(screen.getAllByTestId(/import-v2-preview-row-/)).toHaveLength(20);
    expect(screen.queryByText("Product 21")).toBeNull();
    expect(screen.getByText("Показаны первые 20 из 21 строк")).toBeTruthy();
  });

  it("shows a localized parse error with row and column context", async () => {
    const { core, scenario } = makeWorld();
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.managerUserId }), <ImportV2Screen />)
    );

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    fireEvent.changeText(
      screen.getByTestId("import-v2-csv-input"),
      "Name,Quantity\nBread,three"
    );
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));

    expect(screen.getByTestId("import-v2-parse-error")).toHaveTextContent(
      "Строка 2, столбец Количество: недопустимое числовое значение"
    );
    expect(screen.queryByTestId("import-v2-preview")).toBeNull();
  });

  it("uses the Russian price label in numeric parse errors", async () => {
    const { core, scenario } = makeWorld();
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.managerUserId }), <ImportV2Screen />)
    );

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    fireEvent.changeText(
      screen.getByTestId("import-v2-csv-input"),
      "Name,Price\nBread,-1"
    );
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));

    expect(screen.getByTestId("import-v2-parse-error")).toHaveTextContent(
      "Строка 2, столбец Цена: недопустимое числовое значение"
    );
  });

  it("renders a localized empty name cell error", async () => {
    const { core, scenario } = makeWorld();
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.managerUserId }), <ImportV2Screen />)
    );

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    fireEvent.changeText(
      screen.getByTestId("import-v2-csv-input"),
      "Name,Quantity\n   ,2"
    );
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));

    expect(screen.getByTestId("import-v2-parse-error")).toHaveTextContent(
      "Строка 2: укажите название товара"
    );
    expect(screen.queryByTestId("import-v2-preview")).toBeNull();
  });

  it("uploads parsed records and shows the confirmed batch in the store list", async () => {
    const { core, scenario } = makeWorld();
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.staffUserId }), <ImportV2Screen />)
    );

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("import-v2-filename-input"), "delivery.csv");
    fireEvent.changeText(
      screen.getByTestId("import-v2-csv-input"),
      "Name,Quantity\nFresh bread loaf,12"
    );
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));
    fireEvent.press(screen.getByTestId("import-v2-upload-button"));

    await waitFor(() =>
      expect(screen.getByTestId("import-v2-upload-success")).toHaveTextContent(
        "Пакет подтверждён сервисом магазина"
      )
    );
    expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy();
    expect(screen.getByText("delivery.csv")).toBeTruthy();
    expect(screen.getByText("Ожидают проверки: 1")).toBeTruthy();
  });

  it("loads an ambiguous record, selects a candidate, and approves it", async () => {
    const { core, scenario } = makeWorld();
    core.addProduct({
      barcode: "4780000000011",
      confidence: "low",
      onHandQuantity: 2,
      productName: "Second bread",
      storeId: scenario.storeId,
    });
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.managerUserId }), <ImportV2Screen />)
    );

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("import-v2-filename-input"), "ambiguous.csv");
    fireEvent.changeText(
      screen.getByTestId("import-v2-csv-input"),
      "Name,Barcode,Quantity\nBread delivery,4780000000011,5"
    );
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));
    fireEvent.press(screen.getByTestId("import-v2-upload-button"));

    await waitFor(() => expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-1"));
    await waitFor(() => expect(screen.getByTestId("import-v2-record-staged-record-1")).toBeTruthy());
    expect(screen.getByText("Неоднозначное совпадение")).toBeTruthy();

    fireEvent.press(
      screen.getByTestId(`import-v2-candidate-staged-record-1-${scenario.highConfidenceProductId}`)
    );
    fireEvent.press(screen.getByTestId("import-v2-approve-staged-record-1"));

    await waitFor(() =>
      expect(screen.getByTestId("import-v2-record-status-staged-record-1")).toHaveTextContent(
        "Одобрено"
      )
    );
    expect(screen.getByText("Ожидают проверки: 0")).toBeTruthy();
  });

  it("explicitly approves an unmatched row as a new product with a null target", async () => {
    const { core, scenario } = makeWorld();
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.ownerUserId }), <ImportV2Screen />)
    );

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("import-v2-filename-input"), "new.csv");
    fireEvent.changeText(
      screen.getByTestId("import-v2-csv-input"),
      "Name,Barcode,Quantity,Price\nNew sesame roll,ROLL-01,7,4500"
    );
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));
    fireEvent.press(screen.getByTestId("import-v2-upload-button"));
    await waitFor(() => expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-1"));
    await waitFor(() => expect(screen.getByTestId("import-v2-record-staged-record-1")).toBeTruthy());

    expect(screen.getByText("Совпадений нет")).toBeTruthy();
    expect(screen.getByText(/количество из файла сохраняется как наблюдение/i)).toBeTruthy();
    fireEvent.press(screen.getByTestId("import-v2-approve-new-staged-record-1"));

    await waitFor(() =>
      expect(screen.getByTestId("import-v2-decision-success-staged-record-1")).toHaveTextContent(
        "Решение сохранено. После импорта товар нужно пересчитать, прежде чем использовать его для оффера."
      )
    );
    expect(screen.getByTestId("import-v2-record-status-staged-record-1")).toHaveTextContent(
      "Одобрено"
    );
  });

  it("hides approve as new for an automatically matched row", async () => {
    const { core, scenario } = makeWorld();
    const api = core.sellerApi({ userId: scenario.managerUserId });
    await api.uploadImportBatchV2({
      filename: "auto-match.csv",
      idempotencyKey: "auto-match-seed",
      records: [{ rawName: "Fresh bread loaf", rawBarcode: "4780000000011" }],
      storeId: scenario.storeId,
    });
    const screen = render(providerTree(api, <ImportV2Screen />));

    await waitFor(() => expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-1"));
    await waitFor(() => expect(screen.getByTestId("import-v2-record-staged-record-1")).toBeTruthy());

    expect(screen.queryByTestId("import-v2-approve-new-staged-record-1")).toBeNull();
    expect(screen.getByTestId("import-v2-approve-staged-record-1")).toBeTruthy();
  });

  it("rejects a staged row and refreshes the record and completed batch", async () => {
    const { core, scenario } = makeWorld();
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.managerUserId }), <ImportV2Screen />)
    );

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("import-v2-filename-input"), "reject.csv");
    fireEvent.changeText(screen.getByTestId("import-v2-csv-input"), "Name\nDamaged carton");
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));
    fireEvent.press(screen.getByTestId("import-v2-upload-button"));
    await waitFor(() => expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-1"));
    await waitFor(() => expect(screen.getByTestId("import-v2-reject-staged-record-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-reject-staged-record-1"));

    await waitFor(() =>
      expect(screen.getByTestId("import-v2-record-status-staged-record-1")).toHaveTextContent(
        "Отклонено"
      )
    );
    expect(screen.getByTestId("import-v2-batch-status-import-batch-1")).toHaveTextContent(
      "Завершён"
    );
  });

  it("shows a batch facade error and retries into the honest empty state", async () => {
    const { core, scenario } = makeWorld();
    const workingApi = core.sellerApi({ userId: scenario.staffUserId });
    let calls = 0;
    const flakyApi = withImportTransport(workingApi, {
      fail: (event) =>
        event.method === "listImportBatchesV2" && event.call === 1
          ? "Batch list offline"
          : null,
      observe: (event) => {
        if (event.method === "listImportBatchesV2") calls = event.call;
      },
    });
    const screen = render(providerTree(flakyApi, <ImportV2Screen />));

    await waitFor(() => expect(screen.getByTestId("import-v2-batches-error")).toBeTruthy());
    expect(screen.getByText("Batch list offline")).toBeTruthy();
    fireEvent.press(screen.getByTestId("import-v2-batches-retry"));

    await waitFor(() => expect(screen.getByTestId("import-v2-batches-empty")).toBeTruthy());
    expect(calls).toBe(2);
  });

  it("lets staff upload and review while withholding decision controls", async () => {
    const { core, scenario } = makeWorld();
    const staffApi = core.sellerApi({ userId: scenario.staffUserId });
    await staffApi.uploadImportBatchV2({
      filename: "staff-review.csv",
      idempotencyKey: "staff-review-seed",
      records: [{ rawName: "Staff review row", rawQuantity: 2 }],
      storeId: scenario.storeId,
    });
    const screen = render(providerTree(staffApi, <ImportV2Screen />));

    await waitFor(() => expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-1"));
    await waitFor(() => expect(screen.getByTestId("import-v2-record-staged-record-1")).toBeTruthy());

    expect(screen.getByTestId("import-v2-staff-review-note")).toHaveTextContent(
      "Сотрудники могут проверять строки, решение принимает менеджер или владелец"
    );
    expect(screen.queryByTestId("import-v2-approve-staged-record-1")).toBeNull();
    expect(screen.queryByTestId("import-v2-approve-new-staged-record-1")).toBeNull();
    expect(screen.queryByTestId("import-v2-reject-staged-record-1")).toBeNull();
    expect(screen.getByTestId("import-v2-filename-input")).toBeTruthy();
  });

  it("shows a staged-record fetch error and retries the selected batch", async () => {
    const { core, scenario } = makeWorld();
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    await workingApi.uploadImportBatchV2({
      filename: "records.csv",
      idempotencyKey: "records-error-seed",
      records: [{ rawName: "Retry row" }],
      storeId: scenario.storeId,
    });
    let calls = 0;
    const flakyApi = withImportTransport(workingApi, {
      fail: (event) =>
        event.method === "listStagedRecordsV2" && event.call === 1
          ? "Records offline"
          : null,
      observe: (event) => {
        if (event.method === "listStagedRecordsV2") calls = event.call;
      },
    });
    const screen = render(providerTree(flakyApi, <ImportV2Screen />));

    await waitFor(() => expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-1"));
    await waitFor(() => expect(screen.getByTestId("import-v2-records-error")).toBeTruthy());
    expect(screen.getByText("Records offline")).toBeTruthy();
    fireEvent.press(screen.getByTestId("import-v2-records-retry"));

    await waitFor(() => expect(screen.getByTestId("import-v2-record-staged-record-1")).toBeTruthy());
    expect(calls).toBe(2);
  });

  it("shows an upload error without success and retries the same action key", async () => {
    const { core, scenario } = makeWorld();
    const workingApi = core.sellerApi({ userId: scenario.staffUserId });
    const keys: string[] = [];
    const flakyApi = withImportTransport(workingApi, {
      fail: (event) =>
        event.method === "uploadImportBatchV2" && event.call === 1
          ? "Upload offline"
          : null,
      observe: (event) => {
        if (event.method === "uploadImportBatchV2") {
          keys.push((event.input as { idempotencyKey: string }).idempotencyKey);
        }
      },
    });
    const screen = render(providerTree(flakyApi, <ImportV2Screen />));

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("import-v2-filename-input"), "retry.csv");
    fireEvent.changeText(screen.getByTestId("import-v2-csv-input"), "Name\nRetry upload");
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));
    fireEvent.press(screen.getByTestId("import-v2-upload-button"));
    await waitFor(() => expect(screen.getByTestId("import-v2-upload-error")).toHaveTextContent("Upload offline"));
    expect(screen.queryByTestId("import-v2-upload-success")).toBeNull();

    fireEvent.press(screen.getByTestId("import-v2-upload-button"));
    await waitFor(() => expect(screen.getByTestId("import-v2-upload-success")).toBeTruthy());
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it("shows a decision error without changing the staged record to success", async () => {
    const { core, scenario } = makeWorld();
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    await workingApi.uploadImportBatchV2({
      filename: "decision-error.csv",
      idempotencyKey: "decision-error-seed",
      records: [{ rawName: "Decision error row" }],
      storeId: scenario.storeId,
    });
    const failingApi = withImportTransport(workingApi, {
      fail: (event) => event.method === "decideStagedRecordV2" ? "Decision offline" : null,
    });
    const screen = render(providerTree(failingApi, <ImportV2Screen />));

    await waitFor(() => expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-1"));
    await waitFor(() => expect(screen.getByTestId("import-v2-reject-staged-record-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-reject-staged-record-1"));

    await waitFor(() =>
      expect(screen.getByTestId("import-v2-decision-error-staged-record-1")).toHaveTextContent(
        "Decision offline"
      )
    );
    expect(screen.getByTestId("import-v2-record-status-staged-record-1")).toHaveTextContent(
      "Совпадений нет"
    );
    expect(screen.queryByTestId("import-v2-decision-success-staged-record-1")).toBeNull();
  });

  it("refreshes a record and batch when another manager completes the decision first", async () => {
    const { core, scenario } = makeWorld();
    const firstManager = core.sellerApi({ userId: scenario.managerUserId });
    const secondManager = core.sellerApi({ userId: scenario.ownerUserId });
    const uploaded = await firstManager.uploadImportBatchV2({
      filename: "concurrent-decision.csv",
      idempotencyKey: "concurrent-decision-upload",
      records: [{ rawName: "Concurrently reviewed row" }],
      storeId: scenario.storeId,
    });
    if (!uploaded.ok) {
      throw new Error(uploaded.error.message);
    }
    const staged = await firstManager.listStagedRecordsV2(
      scenario.storeId,
      uploaded.value.id
    );
    if (!staged.ok || !staged.value[0]) {
      throw new Error(staged.ok ? "staged record missing" : staged.error.message);
    }
    const recordId = staged.value[0].id;
    let competingDecisionCalls = 0;
    const racingApi = withImportTransport(firstManager, {
      before: async (event) => {
        if (event.method !== "decideStagedRecordV2") return;
        competingDecisionCalls += 1;
        const competing = await secondManager.decideStagedRecordV2({
          decision: "reject",
          idempotencyKey: "competing-manager-decision",
          recordId,
          storeId: scenario.storeId,
          targetStoreProductId: null,
        });
        if (!competing.ok) {
          throw new Error(competing.error.message);
        }
      },
    });
    const screen = render(providerTree(racingApi, <ImportV2Screen />));

    await waitFor(() =>
      expect(screen.getByTestId(`import-v2-batch-${uploaded.value.id}`)).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId(`import-v2-batch-${uploaded.value.id}`));
    await waitFor(() =>
      expect(screen.getByTestId(`import-v2-reject-${recordId}`)).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId(`import-v2-reject-${recordId}`));

    await waitFor(() =>
      expect(screen.getByTestId(`import-v2-record-status-${recordId}`)).toHaveTextContent(
        "Отклонено"
      )
    );
    expect(screen.getByTestId(`import-v2-batch-status-${uploaded.value.id}`)).toHaveTextContent(
      "Завершён"
    );
    expect(competingDecisionCalls).toBe(1);
  });

  it("guards an in-flight decision from duplicate presses", async () => {
    const { core, scenario } = makeWorld();
    const workingApi = core.sellerApi({ userId: scenario.managerUserId });
    await workingApi.uploadImportBatchV2({
      filename: "guard.csv",
      idempotencyKey: "guard-seed",
      records: [{ rawName: "Guard row" }],
      storeId: scenario.storeId,
    });
    let release: (() => void) | null = null;
    let decisionCalls = 0;
    const delayedApi = withImportTransport(workingApi, {
      before: async (event) => {
        if (event.method === "decideStagedRecordV2") {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
      },
      observe: (event) => {
        if (event.method === "decideStagedRecordV2") decisionCalls = event.call;
      },
    });
    const screen = render(providerTree(delayedApi, <ImportV2Screen />));

    await waitFor(() => expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-1"));
    await waitFor(() => expect(screen.getByTestId("import-v2-reject-staged-record-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-reject-staged-record-1"));
    fireEvent.press(screen.getByTestId("import-v2-reject-staged-record-1"));

    expect(decisionCalls).toBe(1);
    expect(screen.getByTestId("import-v2-reject-staged-record-1")).toBeDisabled();
    await act(async () => {
      release?.();
    });
    await waitFor(() =>
      expect(screen.getByTestId("import-v2-record-status-staged-record-1")).toHaveTextContent(
        "Отклонено"
      )
    );
  });

  it("renders the batch loading state before an honest empty result", async () => {
    const { core, scenario } = makeWorld();
    const workingApi = core.sellerApi({ userId: scenario.staffUserId });
    let release: (() => void) | null = null;
    const delayedApi = withImportTransport(workingApi, {
      before: async (event) => {
        if (event.method === "listImportBatchesV2") {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
      },
    });
    const screen = render(providerTree(delayedApi, <ImportV2Screen />));

    await waitFor(() => expect(screen.getByTestId("import-v2-batches-loading")).toBeTruthy());
    await act(async () => {
      release?.();
    });
    await waitFor(() => expect(screen.getByTestId("import-v2-batches-empty")).toBeTruthy());
  });

  it("guards an in-flight upload from duplicate presses", async () => {
    const { core, scenario } = makeWorld();
    const workingApi = core.sellerApi({ userId: scenario.staffUserId });
    let release: (() => void) | null = null;
    let uploadCalls = 0;
    const delayedApi = withImportTransport(workingApi, {
      before: async (event) => {
        if (event.method === "uploadImportBatchV2") {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
      },
      observe: (event) => {
        if (event.method === "uploadImportBatchV2") uploadCalls = event.call;
      },
    });
    const screen = render(providerTree(delayedApi, <ImportV2Screen />));

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("import-v2-filename-input"), "guard.csv");
    fireEvent.changeText(screen.getByTestId("import-v2-csv-input"), "Name\nGuard upload");
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));
    fireEvent.press(screen.getByTestId("import-v2-upload-button"));
    fireEvent.press(screen.getByTestId("import-v2-upload-button"));

    expect(uploadCalls).toBe(1);
    expect(screen.getByTestId("import-v2-upload-button")).toBeDisabled();
    await act(async () => {
      release?.();
    });
    await waitFor(() => expect(screen.getByTestId("import-v2-upload-success")).toBeTruthy());
  });

  it("opens CSV import from the existing v2 inventory hub", async () => {
    const { core, scenario } = makeWorld();
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.staffUserId }), <InventoryV2Screen />)
    );

    await waitFor(() => expect(screen.getByTestId("inventory-v2-import-button")).toBeTruthy());
    fireEvent.press(screen.getByTestId("inventory-v2-import-button"));

    expect(mockPush).toHaveBeenCalledWith("/(seller-tabs)/import-v2");
  });

  it("clears a parsed preview when the pasted source changes", async () => {
    const { core, scenario } = makeWorld();
    const screen = render(
      providerTree(core.sellerApi({ userId: scenario.staffUserId }), <ImportV2Screen />)
    );

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("import-v2-filename-input"), "changed.csv");
    fireEvent.changeText(screen.getByTestId("import-v2-csv-input"), "Name\nFirst row");
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));
    expect(screen.getByTestId("import-v2-preview")).toBeTruthy();

    fireEvent.changeText(screen.getByTestId("import-v2-csv-input"), "Name\nChanged row");

    expect(screen.queryByTestId("import-v2-preview")).toBeNull();
    expect(screen.queryByTestId("import-v2-upload-button")).toBeNull();
  });

  it("does not offer upload controls to an operator role the facade rejects", async () => {
    const core = new InMemoryStoreCore();
    const storeId = core.createStore({
      name: "Operator store",
      pilotModeEnabled: true,
      shopSellerBetaEnabled: true,
    });
    core.addMembership({ role: "operator", storeId, userId: "import-operator" });
    const screen = render(
      providerTree(core.sellerApi({ userId: "import-operator" }), <ImportV2Screen />)
    );

    await waitFor(() => expect(screen.getByTestId("import-v2-upload-forbidden")).toBeTruthy());
    expect(screen.queryByTestId("import-v2-csv-input")).toBeNull();
    expect(screen.queryByTestId("import-v2-upload-button")).toBeNull();
  });

  it("uses the transport boundary helper to defer and then delegate to the real fake", async () => {
    const { core, scenario } = makeWorld();
    const realApi = core.sellerApi({ userId: scenario.staffUserId });
    const events: ImportTransportEvent[] = [];
    let release: (() => void) | null = null;
    const api = withImportTransport(realApi, {
      before: async (event) => {
        if (event.method === "uploadImportBatchV2") {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
      },
      observe: (event) => events.push(event),
    });
    const screen = render(providerTree(api, <ImportV2Screen />));

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    fireEvent.changeText(screen.getByTestId("import-v2-filename-input"), "boundary.csv");
    fireEvent.changeText(screen.getByTestId("import-v2-csv-input"), "Name\nBoundary row");
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));
    fireEvent.press(screen.getByTestId("import-v2-upload-button"));

    await waitFor(() =>
      expect(events.some((event) => event.method === "uploadImportBatchV2")).toBe(true)
    );
    expect(screen.queryByTestId("import-v2-upload-success")).toBeNull();
    await act(async () => {
      release?.();
    });

    await waitFor(() => expect(screen.getByText("boundary.csv")).toBeTruthy());
    expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy();
  });

  it("does not publish an upload completion or refresh after the active store changes", async () => {
    const { core, scenario } = makeWorld();
    const firstStoreApi = core.sellerApi({ userId: scenario.staffUserId });
    const secondStoreApi = core.sellerApi({
      userId: scenario.otherStoreOwnerUserId,
    });
    const firstStoreEvents: ImportTransportEvent[] = [];
    const secondStoreEvents: ImportTransportEvent[] = [];
    let releaseUpload: (() => void) | null = null;
    const delayedFirstStoreApi = withImportTransport(firstStoreApi, {
      before: async (event) => {
        if (event.method === "uploadImportBatchV2") {
          await new Promise<void>((resolve) => {
            releaseUpload = resolve;
          });
        }
      },
      observe: (event) => firstStoreEvents.push(event),
    });
    const observedSecondStoreApi = withImportTransport(secondStoreApi, {
      observe: (event) => secondStoreEvents.push(event),
    });
    const screen = render(
      providerTree(delayedFirstStoreApi, <ImportV2Screen />)
    );

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    fireEvent.changeText(
      screen.getByTestId("import-v2-filename-input"),
      "store-switch-upload.csv"
    );
    fireEvent.changeText(
      screen.getByTestId("import-v2-csv-input"),
      "Name\nStore switch upload"
    );
    fireEvent.press(screen.getByTestId("import-v2-parse-button"));
    fireEvent.press(screen.getByTestId("import-v2-upload-button"));
    await waitFor(() => expect(releaseUpload).not.toBeNull());

    screen.rerender(providerTree(observedSecondStoreApi, <ImportV2Screen />));
    await waitFor(() =>
      expect(
        secondStoreEvents.some(
          (event) => event.method === "listImportBatchesV2"
        )
      ).toBe(true)
    );
    await act(async () => {
      releaseUpload?.();
    });
    await waitFor(async () => {
      const batches = await firstStoreApi.listImportBatchesV2(scenario.storeId);
      expect(
        batches.ok &&
          batches.value.some(
            (batch) => batch.filename === "store-switch-upload.csv"
          )
      ).toBe(true);
    });

    expect(screen.queryByTestId("import-v2-upload-success")).toBeNull();
    expect(screen.getByTestId("import-v2-filename-input")).toHaveProp(
      "value",
      "store-switch-upload.csv"
    );
    expect(screen.getByTestId("import-v2-filename-input")).toBeEnabled();
    expect(
      firstStoreEvents.filter(
        (event) => event.method === "listImportBatchesV2"
      )
    ).toHaveLength(1);
  });

  it("does not publish a decision completion or refresh after the active store changes", async () => {
    const { core, scenario } = makeWorld();
    const firstStoreApi = core.sellerApi({ userId: scenario.managerUserId });
    const secondStoreApi = core.sellerApi({
      userId: scenario.otherStoreOwnerUserId,
    });
    const uploaded = await firstStoreApi.uploadImportBatchV2({
      filename: "store-switch-decision.csv",
      idempotencyKey: "store-switch-decision-upload",
      records: [{ rawName: "Store switch decision" }],
      storeId: scenario.storeId,
    });
    if (!uploaded.ok) {
      throw new Error(uploaded.error.message);
    }
    const staged = await firstStoreApi.listStagedRecordsV2(
      scenario.storeId,
      uploaded.value.id
    );
    if (!staged.ok || !staged.value[0]) {
      throw new Error(staged.ok ? "staged record missing" : staged.error.message);
    }
    const recordId = staged.value[0].id;
    const firstStoreEvents: ImportTransportEvent[] = [];
    const secondStoreEvents: ImportTransportEvent[] = [];
    let releaseDecision: (() => void) | null = null;
    const delayedFirstStoreApi = withImportTransport(firstStoreApi, {
      before: async (event) => {
        if (event.method === "decideStagedRecordV2") {
          await new Promise<void>((resolve) => {
            releaseDecision = resolve;
          });
        }
      },
      observe: (event) => firstStoreEvents.push(event),
    });
    const observedSecondStoreApi = withImportTransport(secondStoreApi, {
      observe: (event) => secondStoreEvents.push(event),
    });
    const screen = render(
      providerTree(delayedFirstStoreApi, <ImportV2Screen />)
    );

    await waitFor(() =>
      expect(screen.getByTestId(`import-v2-batch-${uploaded.value.id}`)).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId(`import-v2-batch-${uploaded.value.id}`));
    await waitFor(() =>
      expect(screen.getByTestId(`import-v2-reject-${recordId}`)).toBeTruthy()
    );
    fireEvent.press(screen.getByTestId(`import-v2-reject-${recordId}`));
    await waitFor(() => expect(releaseDecision).not.toBeNull());

    screen.rerender(providerTree(observedSecondStoreApi, <ImportV2Screen />));
    await waitFor(() =>
      expect(
        secondStoreEvents.some(
          (event) => event.method === "listImportBatchesV2"
        )
      ).toBe(true)
    );
    await act(async () => {
      releaseDecision?.();
    });
    await waitFor(async () => {
      const records = await firstStoreApi.listStagedRecordsV2(
        scenario.storeId,
        uploaded.value.id
      );
      expect(records.ok && records.value[0]?.matchStatus).toBe("rejected");
    });

    expect(screen.queryByTestId(`import-v2-decision-success-${recordId}`)).toBeNull();
    expect(
      firstStoreEvents.filter(
        (event) => event.method === "listImportBatchesV2"
      )
    ).toHaveLength(1);
  });

  it("ignores an older staged-record response after a newer batch selection", async () => {
    const { core, scenario } = makeWorld();
    const realApi = core.sellerApi({ userId: scenario.managerUserId });
    await realApi.uploadImportBatchV2({
      filename: "first.csv",
      idempotencyKey: "out-of-order-first",
      records: [{ rawName: "First batch row" }],
      storeId: scenario.storeId,
    });
    await realApi.uploadImportBatchV2({
      filename: "second.csv",
      idempotencyKey: "out-of-order-second",
      records: [{ rawName: "Second batch row" }],
      storeId: scenario.storeId,
    });
    let releaseFirst: (() => void) | null = null;
    const api = withImportTransport(realApi, {
      before: async (event) => {
        const input = event.input as { batchId?: string };
        if (event.method === "listStagedRecordsV2" && input.batchId === "import-batch-1") {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
        }
      },
    });
    const screen = render(providerTree(api, <ImportV2Screen />));

    await waitFor(() => expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-1"));
    await waitFor(() => expect(releaseFirst).not.toBeNull());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-2"));
    await waitFor(() => expect(screen.getByText("Second batch row")).toBeTruthy());

    await act(async () => {
      releaseFirst?.();
    });

    await waitFor(() => expect(screen.getByText("Second batch row")).toBeTruthy());
    expect(screen.queryByText("First batch row")).toBeNull();
  });

  it("does not rebind an old batch when its decision finishes after selection changed", async () => {
    const { core, scenario } = makeWorld();
    const realApi = core.sellerApi({ userId: scenario.managerUserId });
    await realApi.uploadImportBatchV2({
      filename: "deciding.csv",
      idempotencyKey: "decision-switch-first",
      records: [{ rawName: "Deciding old row" }],
      storeId: scenario.storeId,
    });
    await realApi.uploadImportBatchV2({
      filename: "current.csv",
      idempotencyKey: "decision-switch-second",
      records: [{ rawName: "Current selected row" }],
      storeId: scenario.storeId,
    });
    let releaseDecision: (() => void) | null = null;
    const api = withImportTransport(realApi, {
      before: async (event) => {
        if (event.method === "decideStagedRecordV2") {
          await new Promise<void>((resolve) => {
            releaseDecision = resolve;
          });
        }
      },
    });
    const screen = render(providerTree(api, <ImportV2Screen />));

    await waitFor(() => expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-1"));
    await waitFor(() => expect(screen.getByText("Deciding old row")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-reject-staged-record-1"));
    await waitFor(() => expect(releaseDecision).not.toBeNull());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-2"));
    await waitFor(() => expect(screen.getByText("Current selected row")).toBeTruthy());

    await act(async () => {
      releaseDecision?.();
    });

    await waitFor(() => expect(screen.getByText("Current selected row")).toBeTruthy());
    expect(screen.queryByText("Deciding old row")).toBeNull();
  });

  it("removes old record cards while a newly selected batch is loading", async () => {
    const { core, scenario } = makeWorld();
    const realApi = core.sellerApi({ userId: scenario.managerUserId });
    await realApi.uploadImportBatchV2({
      filename: "loaded.csv",
      idempotencyKey: "transition-loaded",
      records: [{ rawName: "Loaded old row" }],
      storeId: scenario.storeId,
    });
    await realApi.uploadImportBatchV2({
      filename: "loading.csv",
      idempotencyKey: "transition-loading",
      records: [{ rawName: "Loading new row" }],
      storeId: scenario.storeId,
    });
    let releaseNext: (() => void) | null = null;
    const api = withImportTransport(realApi, {
      before: async (event) => {
        const input = event.input as { batchId?: string };
        if (event.method === "listStagedRecordsV2" && input.batchId === "import-batch-2") {
          await new Promise<void>((resolve) => {
            releaseNext = resolve;
          });
        }
      },
    });
    const screen = render(providerTree(api, <ImportV2Screen />));

    await waitFor(() => expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-1"));
    await waitFor(() => expect(screen.getByText("Loaded old row")).toBeTruthy());
    fireEvent.press(screen.getByTestId("import-v2-batch-import-batch-2"));

    await waitFor(() => expect(screen.getByTestId("import-v2-records-loading")).toBeTruthy());
    expect(screen.queryByText("Loaded old row")).toBeNull();
    expect(screen.queryByTestId("import-v2-reject-staged-record-1")).toBeNull();

    await act(async () => {
      releaseNext?.();
    });
    await waitFor(() => expect(screen.getByText("Loading new row")).toBeTruthy());
  });

  it("ends a successful upload action and gives a later identical upload a new key", async () => {
    const { core, scenario } = makeWorld();
    const realApi = core.sellerApi({ userId: scenario.staffUserId });
    const keys: string[] = [];
    const api = withImportTransport(realApi, {
      observe: (event) => {
        if (event.method === "uploadImportBatchV2") {
          keys.push((event.input as { idempotencyKey: string }).idempotencyKey);
        }
      },
    });
    const screen = render(providerTree(api, <ImportV2Screen />));
    const uploadIdenticalBatch = () => {
      fireEvent.changeText(screen.getByTestId("import-v2-filename-input"), "identical.csv");
      fireEvent.changeText(screen.getByTestId("import-v2-csv-input"), "Name\nIdentical row");
      fireEvent.press(screen.getByTestId("import-v2-parse-button"));
      fireEvent.press(screen.getByTestId("import-v2-upload-button"));
    };

    await waitFor(() => expect(screen.getByTestId("import-v2-csv-input")).toBeTruthy());
    uploadIdenticalBatch();
    await waitFor(() => expect(screen.getByTestId("import-v2-batch-import-batch-1")).toBeTruthy());

    expect(screen.getByTestId("import-v2-filename-input")).toHaveProp("value", "");
    expect(screen.getByTestId("import-v2-csv-input")).toHaveProp("value", "");
    expect(screen.queryByTestId("import-v2-preview")).toBeNull();

    uploadIdenticalBatch();
    await waitFor(() => expect(screen.getByTestId("import-v2-batch-import-batch-2")).toBeTruthy());
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });
});
