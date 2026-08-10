import type { OwnerDigestV2 } from "@/lib/contracts";
import digestFormatter from "./digest-format.cjs";

export const formatDigestRu: (digest: OwnerDigestV2) => string =
  digestFormatter.formatDigestRu;
