export type UserFacingErrorKind =
  | "upstream_pool_unavailable"
  | "auth_failed"
  | "permission_denied"
  | "model_unavailable"
  | "rate_or_quota_limited"
  | "context_overflow"
  | "network_timeout"
  | "upstream_unavailable";

export type UserFacingErrorDiagnosis = {
  kind: UserFacingErrorKind;
  label: string;
  description: string;
  action: string;
  variant: "error" | "warning";
};

type DiagnosisInput = {
  status?: number | string | null;
  message?: unknown;
  responseBody?: unknown;
  pipelinePayloads?: unknown;
};

function toText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeStatus(status: DiagnosisInput["status"]): number | null {
  if (typeof status === "number" && Number.isFinite(status)) return status;
  if (typeof status === "string") {
    const parsed = Number.parseInt(status, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getPayloadStatus(payloads: unknown): number | null {
  if (!payloads || typeof payloads !== "object") return null;
  const record = payloads as Record<string, unknown>;
  const providerResponse = record.providerResponse as Record<string, unknown> | undefined;
  return normalizeStatus(providerResponse?.status as DiagnosisInput["status"]);
}

function makeDiagnosis(
  kind: UserFacingErrorKind,
  label: string,
  description: string,
  action: string,
  variant: "error" | "warning" = "error"
): UserFacingErrorDiagnosis {
  return { kind, label, description, action, variant };
}

export function diagnoseUserFacingError(input: DiagnosisInput): UserFacingErrorDiagnosis | null {
  const status = normalizeStatus(input.status) ?? getPayloadStatus(input.pipelinePayloads);
  const text = [input.message, input.responseBody, input.pipelinePayloads]
    .map(toText)
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  if (!text && (!status || status < 400)) return null;

  if (
    /no available accounts|resource pressure|capacity|overloaded|no available upstream/.test(text)
  ) {
    return makeDiagnosis(
      "upstream_pool_unavailable",
      "上游池无可用账号/资源不足",
      "请求已经到达上游，但上游账号池或资源池暂时没有可用容量。",
      "稍后重试，或在渠道详情中切换/增加可用账号。"
    );
  }

  if (status === 401 || /invalid api key|incorrect api key|unauthorized|invalid token/.test(text)) {
    return makeDiagnosis(
      "auth_failed",
      "鉴权失败",
      "密钥、Token 或登录态无效，上游拒绝了请求。",
      "检查渠道密钥、Cookie/OAuth 登录态或重新授权。"
    );
  }

  if (
    status === 404 ||
    /model .*not found|model_not_found|model not found|does not exist|may not exist|do not have access|not have access|no access/.test(
      text
    )
  ) {
    return makeDiagnosis(
      "model_unavailable",
      "模型不存在或无权限",
      "当前模型 ID 在上游不可用，或该账号没有访问权限。",
      "换用渠道实际支持的模型，或同步模型列表后重新选择。"
    );
  }

  if (
    status === 403 ||
    /forbidden|permission denied|banned|account disabled|account deactivated/.test(text)
  ) {
    return makeDiagnosis(
      "permission_denied",
      "权限不足或账号受限",
      "上游账号可能没有该能力权限，或账号已被限制。",
      "确认账号权限、模型权限和服务商控制台状态。"
    );
  }

  if (
    /context overflow|context length|context window|prompt too large|input too long|too many tokens/.test(
      text
    )
  ) {
    return makeDiagnosis(
      "context_overflow",
      "上下文过长",
      "请求内容超过了目标模型或上游接口的上下文限制。",
      "减少输入内容，或选择更大上下文窗口的模型。",
      "warning"
    );
  }

  if (
    status === 429 ||
    /rate limit|rate_limit|too many requests|quota|credits exhausted|insufficient credits|exceeded/.test(
      text
    )
  ) {
    return makeDiagnosis(
      "rate_or_quota_limited",
      "限流或额度不足",
      "上游触发频率限制，或账号额度/余额不足。",
      "等待重置窗口，降低请求频率，或切换到仍有额度的渠道。",
      "warning"
    );
  }

  if (
    status === 408 ||
    /timeout|timed out|econnreset|econnrefused|enotfound|fetch failed|network error|socket hang up/.test(
      text
    )
  ) {
    return makeDiagnosis(
      "network_timeout",
      "网络或连接超时",
      "OmniRoute 到上游之间的网络连接失败或响应超时。",
      "检查 Base URL、代理/隧道和本机网络后重试。",
      "warning"
    );
  }

  if (status != null && status >= 500) {
    return makeDiagnosis(
      "upstream_unavailable",
      "上游服务不可用",
      "上游返回 5xx 错误，通常是服务临时不可用或网关异常。",
      "稍后重试；如果持续出现，检查渠道服务状态或更换渠道。"
    );
  }

  return null;
}
