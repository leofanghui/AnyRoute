import { NextResponse } from "next/server";
import { getDefaultPricing } from "@/shared/constants/pricing";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

/**
 * GET /api/pricing/defaults
 * Get default pricing configuration
 */
export async function GET() {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  try {
    const defaultPricing = getDefaultPricing();
    return NextResponse.json(defaultPricing);
  } catch (error) {
    console.error("Error fetching default pricing:", error);
    return NextResponse.json({ error: "Failed to fetch default pricing" }, { status: 500 });
  }
}
