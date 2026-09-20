import { NextResponse } from "next/server";
export function GET() {
  return NextResponse.json(
    { error: "The legacy blog has been retired." },
    { status: 410 },
  );
}
export const POST = GET;
