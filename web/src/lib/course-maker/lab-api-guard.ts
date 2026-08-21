import { NextResponse } from "next/server";

const SECRET_HEADERS = ["x-ao-lab-secret", "x-ao-sample-secret"] as const;

function timingSafeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i += 1) out |= aa[i] ^ bb[i];
  return out === 0;
}

function envFlag(...keys: string[]): boolean {
  for (const key of keys) {
    const v = (process.env[key] ?? "").trim().toLowerCase();
    if (v === "1" || v === "true" || v === "yes") return true;
  }
  return false;
}

function envSecret(...keys: string[]): string {
  for (const key of keys) {
    const v = process.env[key]?.trim() ?? "";
    if (v) return v;
  }
  return "";
}

function labApiDisabled(): boolean {
  return envFlag("AO_LAB_API_DISABLED", "AO_SAMPLE_API_DISABLED");
}

/** Vercel 上（Preview / Production）では秘密未設定なら生成系を閉じる */
function onVercel(): boolean {
  return Boolean(process.env.VERCEL?.trim());
}

export type LabApiGuardOpts = {
  /**
   * true: AO_LAB_API_DISABLED / AO_SAMPLE_API_DISABLED でも通す（見積もり・reset など非課金書き込み）。
   * 秘密トークン／Vercel fail-closed は通常どおり。
   */
  allowWhenDisabled?: boolean;
};

/**
 * `/api/lab/**` の POST（書き込み）をガードする。
 *
 * - `AO_LAB_API_DISABLED` または `AO_SAMPLE_API_DISABLED` → 403（`allowWhenDisabled` で免除可）
 * - 秘密は `AO_LAB_API_SECRET` または `AO_SAMPLE_API_SECRET`
 * - ヘッダは `x-ao-lab-secret` または `x-ao-sample-secret`
 * - Vercel 上で秘密未設定 → 403（fail closed）
 * - ローカルで秘密未設定 → 許可（開発便宜）
 *
 * GET（マニフェスト読取）はこの関数の対象外。
 */
export function guardLabApiMutation(
  req: Request,
  opts?: LabApiGuardOpts,
): NextResponse | null {
  if (labApiDisabled() && !opts?.allowWhenDisabled) {
    return NextResponse.json(
      { error: "Lab API は無効化されています（AO_LAB_API_DISABLED）" },
      { status: 403 },
    );
  }

  const secret = envSecret("AO_LAB_API_SECRET", "AO_SAMPLE_API_SECRET");
  if (!secret) {
    if (onVercel()) {
      return NextResponse.json(
        {
          error:
            "Lab 書き込み API は Vercel 上では AO_LAB_API_SECRET（または AO_SAMPLE_API_SECRET）必須です（未設定のため拒否）",
        },
        { status: 403 },
      );
    }
    return null;
  }

  const provided =
    SECRET_HEADERS.map((h) => req.headers.get(h)?.trim() ?? "").find(Boolean) ?? "";
  if (!provided || !timingSafeEqual(provided, secret)) {
    return NextResponse.json(
      {
        error: `ヘッダ ${SECRET_HEADERS.join(" または ")} が不正または未指定です`,
      },
      { status: 401 },
    );
  }
  return null;
}

/** @deprecated 互換エイリアス。新規は guardLabApiMutation */
export const guardSampleApiMutation = guardLabApiMutation;

export const LAB_API_SECRET_HEADER = "x-ao-lab-secret";
/** @deprecated 互換。x-ao-lab-secret も可 */
export const SAMPLE_API_SECRET_HEADER = "x-ao-sample-secret";
