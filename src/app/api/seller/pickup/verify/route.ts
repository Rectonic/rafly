import { NextResponse } from "next/server";

import { verifyPickupOrderForCurrentUser } from "@/lib/backend/seller-repository";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { reservationCode?: string };
    const result = await verifyPickupOrderForCurrentUser(payload.reservationCode ?? "");
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to verify pickup order.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ message }, { status });
  }
}
