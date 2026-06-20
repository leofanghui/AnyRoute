import { NextResponse } from "next/server";
import { getFile, getFileContent } from "@/lib/localDb";
import { requireManagementAuth } from "@/lib/api/requireManagementAuth";
import { disabledRouteIfLean } from "@/lib/api/disabledRoute";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const __lean = disabledRouteIfLean(request);
  if (__lean) return __lean;

  const authError = await requireManagementAuth(request);
  if (authError) return authError;

  const { id } = await params;
  const file = getFile(id);

  if (!file) {
    return NextResponse.json(
      { error: { message: "File not found", type: "invalid_request_error" } },
      { status: 404 }
    );
  }

  const content = getFileContent(id);
  if (!content) {
    return NextResponse.json(
      { error: { message: "File content not found", type: "invalid_request_error" } },
      { status: 404 }
    );
  }

  const filename = file.filename || id;
  return new Response(content as unknown as BodyInit, {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
