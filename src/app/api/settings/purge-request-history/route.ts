import { NextResponse } from "next/server";
import { buildErrorBody } from "@omniroute/open-sse/utils/error";
import { getDbInstance } from "@/lib/db/core";
import { purgeCallLogArtifactDirectory } from "@/lib/usage/callLogArtifacts";
import { isAuthenticated } from "@/shared/utils/apiAuth";

export const runtime = "nodejs";

function tableExists(tableName: string) {
  const db = getDbInstance();
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName) as { name?: string } | undefined;
  return Boolean(row?.name);
}

function deleteAllRows(tableName: string) {
  if (!tableExists(tableName)) return 0;
  const db = getDbInstance();
  const count = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get() as {
    count?: number;
  };
  db.prepare(`DELETE FROM ${tableName}`).run();
  return Number(count?.count || 0);
}

export async function POST(request: Request) {
  if (!(await isAuthenticated(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const deleted = deleteAllRows("call_logs");
    const deletedDetailedLogs = deleteAllRows("request_detail_logs");
    const artifacts = purgeCallLogArtifactDirectory();

    return NextResponse.json(
      {
        deleted,
        deletedArtifacts: artifacts.deletedArtifacts,
        deletedDetailedLogs,
        errors: artifacts.errors,
      },
      { status: artifacts.errors > 0 ? 500 : 200 }
    );
  } catch {
    return NextResponse.json(buildErrorBody(500, "Failed to purge request history"), {
      status: 500,
    });
  }
}
