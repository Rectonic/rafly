import { NextResponse } from "next/server";

import { updateSellerProfileForCurrentUser } from "@/lib/backend/seller-repository";
import type { UpdateSellerProfileInput } from "@/lib/backend/contracts";

export async function PUT(request: Request) {
  try {
    const payload = (await request.json()) as UpdateSellerProfileInput;
    const workspace = await updateSellerProfileForCurrentUser(payload);
    return NextResponse.json(workspace, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save seller profile.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ message }, { status });
  }
}
