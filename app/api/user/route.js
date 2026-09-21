import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getUser } from "@/lib/user";
export async function GET() {
  const { user } = await verifyAuth();
  if (!user)
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const current = await getUser(user.id);
  return NextResponse.json({
    id: current.id,
    username: current.username,
    avatar_url: current.avatar_url,
  });
}
