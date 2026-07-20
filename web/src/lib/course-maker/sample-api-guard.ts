import { NextResponse } from "next/server";

const SECRET_HEADER = "x-ao-sample-secret";

function timingSafeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i += 1) out |= aa[i] ^ bb[i];
  return out === 0;
}

function sampleApiDisabled(): boolean {
  const v = (process.env.AO_SAMPLE_API_DISABLED ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Vercel 上（Preview / Production）では秘密未設定なら生成系を閉じる */
function onVercel(): boolean {
  return Boolean(process.env.VERCEL?.trim());
}

export type SampleApiGuardOpts = {
  /**
   * true: AO_SAMPLE_API_DISABLED でも通す（見積もり・reset など非課金書き込み）。
   * 秘密トークン／Vercel fail-closed は通常どおり。
   */
  allowWhenDisabled?: boolean;
};

/**
 * `/api/sample/**` の POST（書き込み）をガードする。
 *
 * - `AO_SAMPLE_API_DISABLED=1` → 403（`allowWhenDisabled` で免除可）
 * - `AO_SAMPLE_API_SECRET` 設定時 → ヘッダ `x-ao-sample-secret` が一致必須
 * - Vercel 上で秘密未設定 → 403（fail closed）
 * - ローカルで秘密未設定 → 許可（開発便宜）
 *
 * GET（マニフェスト読取）はこの関数の対象外。
 */
export function guardSampleApiMutation(
  req: Request,
  opts?: SampleApiGuardOpts,
): NextResponse | null {
  if (sampleApiDisabled() && !opts?.allowWhenDisabled) {
    return NextResponse.json(
      { error: "Sample API は無効化されています（AO_SAMPLE_API_DISABLED）" },
      { status: 403 },
    );
  }

  const secret = process.env.AO_SAMPLE_API_SECRET?.trim() ?? "";
  if (!secret) {
    if (onVercel()) {
      return NextResponse.json(
        {
          error:
            "Sample 書き込み API は Vercel 上では AO_SAMPLE_API_SECRET 必須です（未設定のため拒否）",
        },
        { status: 403 },
      );
    }
    return null;
  }

  const provided = req.headers.get(SECRET_HEADER)?.trim() ?? "";
  if (!provided || !timingSafeEqual(provided, secret)) {
    return NextResponse.json(
      { error: `ヘッダ ${SECRET_HEADER} が不正または未指定です` },
      { status: 401 },
    );
  }
  return null;
}

export const SAMPLE_API_SECRET_HEADER = SECRET_HEADER;
