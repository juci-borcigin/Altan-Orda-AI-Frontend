/**
 * LLM / 検索 API エラーを運用向けに分類する。
 */

export type AoLlmErrorCode =
  | "credit_exhausted"
  | "rate_limited"
  | "auth"
  | "invalid_request"
  | "other";

export type ClassifiedLlmError = {
  code: AoLlmErrorCode;
  /** ユーザー向け短文 */
  messageJa: string;
  detail: string;
};

function extractHttpStatus(text: string): number | null {
  const m = text.match(/LLM HTTP (\d{3})/i) || text.match(/\bHTTP (\d{3})\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

export function classifyLlmErrorMessage(raw: string): ClassifiedLlmError {
  const detail = raw.slice(0, 2000);
  const lower = detail.toLowerCase();
  const status = extractHttpStatus(detail);

  const credit =
    /credit balance is too low/i.test(detail) ||
    /insufficient_quota/i.test(detail) ||
    /exceeded your current quota/i.test(detail) ||
    /billing_not_active/i.test(detail) ||
    (status === 402 && /credit|quota|billing|balance/i.test(detail));

  if (credit) {
    const vendorHint = /anthropic/i.test(detail)
      ? "Anthropic"
      : /openai|insufficient_quota/i.test(detail)
        ? "OpenAI"
        : /openrouter/i.test(detail)
          ? "OpenRouter"
          : "API ベンダー";
    return {
      code: "credit_exhausted",
      messageJa: `${vendorHint} の API 残高（または利用枠）が不足しています。各社の課金画面でチャージするか、設定で別モデルに切り替えてください。開発時のみ AO_LLM_FORCE_OPENROUTER=1 も検討できます。`,
      detail,
    };
  }

  if (status === 429 || /rate[_ ]?limit/i.test(lower) || /too many requests/i.test(lower)) {
    return {
      code: "rate_limited",
      messageJa: "API の利用制限（レートリミット）に達しました。しばらく待ってから再送してください。",
      detail,
    };
  }

  if (status === 401 || status === 403 || /invalid_api_key|incorrect api key|authentication/i.test(lower)) {
    return {
      code: "auth",
      messageJa: "API キーが無効か権限がありません。環境変数のキー設定を確認してください。",
      detail,
    };
  }

  if (status === 400 || /invalid_request_error/i.test(lower)) {
    return {
      code: "invalid_request",
      messageJa: "モデルへのリクエスト形式が拒否されました。モデル設定やツール併用の制約を確認してください。",
      detail,
    };
  }

  if (/chat SSE ended without done/i.test(detail)) {
    return {
      code: "other",
      messageJa:
        "サーバーからの応答が途中で切れました。履歴が長い場合は編集で巻き戻すか、しばらく待ってから再送してください。",
      detail,
    };
  }

  return { code: "other", messageJa: detail, detail };
}

export function aoLlmErrorMessageForDisplay(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  return classifyLlmErrorMessage(msg).messageJa;
}
