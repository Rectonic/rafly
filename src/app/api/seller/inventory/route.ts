import { NextResponse } from "next/server";

import { addInventoryItemForCurrentUser } from "@/lib/backend/seller-repository";
import type { CreateInventoryItemInput } from "@/lib/backend/contracts";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as CreateInventoryItemInput;
    const workspace = await addInventoryItemForCurrentUser(payload);
    return NextResponse.json(workspace, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save inventory item.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ message }, { status });
  }
}
