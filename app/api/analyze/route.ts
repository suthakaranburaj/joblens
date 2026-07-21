import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Analyze endpoint not implemented yet." },
    { status: 501 },
  );
}
