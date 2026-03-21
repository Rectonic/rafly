import { NextResponse } from "next/server";

import { getPublishedOffers } from "@/lib/backend/seller-repository";
import { isSupabaseConfigured } from "@/lib/auth";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const offers = await getPublishedOffers();
    return NextResponse.json(offers, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load published offers.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
