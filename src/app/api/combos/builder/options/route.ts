import { NextResponse } from "next/server";
import { getComboBuilderOptions } from "@/lib/combos/builderOptions";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(request: Request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  try {
    const options = await getComboBuilderOptions();
    return NextResponse.json(options);
  } catch (error) {
    console.log("Error fetching combo builder options:", error);
    return NextResponse.json({ error: "Failed to fetch combo builder options" }, { status: 500 });
  }
}
