import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET() {
  const { user } = await verifyAuth();
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json(
    db
      .prepare("SELECT id,username,avatar_url FROM users WHERE id=?")
      .get(user.id),
  );
}
