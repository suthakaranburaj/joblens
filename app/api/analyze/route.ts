import { NextResponse } from "next/server";
import type { AnalysisApiResponse } from "@/types";

export async function POST() {
  const body: AnalysisApiResponse = {
    success: false,
    error: "Analyze endpoint not implemented yet.",
  };

  return NextResponse.json(body, { status: 501 });
}
