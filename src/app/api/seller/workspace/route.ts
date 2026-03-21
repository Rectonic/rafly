import { NextResponse } from "next/server";

import { getSellerWorkspaceForCurrentUser } from "@/lib/backend/seller-repository";

export async function GET() {
  try {
    const workspace = await getSellerWorkspaceForCurrentUser();
    return NextResponse.json(workspace, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load seller workspace.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ message }, { status });
  }
}
