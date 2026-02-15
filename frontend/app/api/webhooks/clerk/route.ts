import { NextResponse } from "next/server";

export async function POST() {
  // TODO: Implement Clerk webhook handler
  return NextResponse.json({ received: true });
}
