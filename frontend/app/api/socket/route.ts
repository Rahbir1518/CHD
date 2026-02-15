// this is route.ts — API route: proxies WebSocket connection info and session management

import { NextResponse } from "next/server";

export async function GET() {
  const wsUrl =
    process.env.NEXT_PUBLIC_WS_URL ||
    (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
      .replace(/^http/, "ws")
      .replace(/\/$/, "");

  return NextResponse.json({ wsUrl });
}