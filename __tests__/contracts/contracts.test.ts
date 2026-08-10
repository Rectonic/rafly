import { err, ok } from "@/lib/contracts";
import type { Result } from "@/lib/contracts";

describe("lib/contracts", () => {
  it("computes retryable per error code", () => {
    const soldOut = err("sold_out", "msg");
    const networkError = err("network_error", "msg");

    if (soldOut.ok) throw new Error("expected an error result");
    if (networkError.ok) throw new Error("expected an error result");

    expect(soldOut.error.retryable).toBe(false);
    expect(networkError.error.retryable).toBe(true);
  });

  it("narrows a successful result through result.ok", () => {
    const result: Result<number> = ok(1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(1);
    }
  });
});
