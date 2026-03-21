import { NextResponse } from "next/server";

import { publishSellerOfferForCurrentUser } from "@/lib/backend/seller-repository";
import type { CreateSellerOfferInput } from "@/lib/backend/contracts";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateSellerOfferInput;
    const workspace = await publishSellerOfferForCurrentUser(payload);
    return NextResponse.json(workspace, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to publish seller offer.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ message }, { status });
  }
}
