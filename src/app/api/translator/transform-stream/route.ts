import { NextResponse } from "next/server";
import { z } from "zod";

import { transformChatCompletionSseToResponses } from "@/lib/translator/streamTransform";
import { isValidationFailure, validateBody } from "@/shared/validation/helpers";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

const transformStreamSchema = z.object({
  rawSse: z.string().min(1).max(100_000),
});

export async function POST(request) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  let rawBody;

  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Invalid request",
          details: [{ field: "body", message: "Invalid JSON body" }],
        },
      },
      { status: 400 }
    );
  }

  const validation = validateBody(transformStreamSchema, rawBody);
  if (isValidationFailure(validation)) {
    return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
  }

  try {
    const transformed = await transformChatCompletionSseToResponses(validation.data.rawSse);
    return NextResponse.json({ success: true, transformed });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to transform chat completions stream",
      },
      { status: 500 }
    );
  }
}
