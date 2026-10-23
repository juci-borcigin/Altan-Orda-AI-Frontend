import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AO_USER_CONTEXT_KEY,
  AO_USER_CONTEXT_MAX_CHARS,
  appendAoUserContext,
  loadAoUserContextBody,
} from "./ao-user-context";

test("empty body leaves the system prompt unchanged", () => {
  const system = "## 1. 指令概要\nそのまま";
  assert.equal(appendAoUserContext(system, ""), system);
  assert.equal(appendAoUserContext(system, "  \n"), system);
  assert.equal(appendAoUserContext(system, null), system);
  assert.equal(appendAoUserContext(system, undefined), system);
});

test("non-empty body is appended in full on every call", () => {
  const system = "令旨の本文";
  const body = "関心の軸は地政学である。\n応答は日本語。";
  const out = appendAoUserContext(system, body);
  assert.match(out, /^令旨の本文\n\n## 殿下の人物コンテキスト\n/);
  assert.ok(out.includes(body));
  assert.equal(out.startsWith(system), true);
});

test("body is trimmed and clipped to the table limit", () => {
  const long = `あ`.repeat(AO_USER_CONTEXT_MAX_CHARS + 50);
  const out = appendAoUserContext("sp", `  ${long}  `);
  const injected = out.split("\n\n").pop() ?? "";
  assert.equal(injected.length, AO_USER_CONTEXT_MAX_CHARS);
  assert.equal(injected.startsWith("あ"), true);
});

function fakeSupa(result: {
  data: { body?: unknown } | null;
  error: { message: string; code?: string } | null;
  throwOnRead?: boolean;
}): SupabaseClient {
  return {
    from(table: string) {
      assert.equal(table, "ao_user_context");
      return {
        select() {
          return {
            eq(column: string, value: string) {
              assert.equal(column, "context_key");
              assert.equal(value, AO_USER_CONTEXT_KEY);
              return {
                maybeSingle: async () => {
                  if (result.throwOnRead) throw new Error("network down");
                  return { data: result.data, error: result.error };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

test("load returns the stored body", async () => {
  const body = await loadAoUserContextBody(
    fakeSupa({ data: { body: "立ち情報" }, error: null }),
  );
  assert.equal(body, "立ち情報");
});

test("load returns empty when the row or table is missing", async () => {
  assert.equal(
    await loadAoUserContextBody(fakeSupa({ data: null, error: null })),
    "",
  );
  assert.equal(
    await loadAoUserContextBody(
      fakeSupa({
        data: null,
        error: { code: "PGRST205", message: "Could not find the table" },
      }),
    ),
    "",
  );
  assert.equal(
    await loadAoUserContextBody(fakeSupa({ data: null, error: null, throwOnRead: true })),
    "",
  );
});
