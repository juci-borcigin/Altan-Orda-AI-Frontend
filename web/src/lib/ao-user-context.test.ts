import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AO_USER_CONTEXT_KEY,
  AO_USER_CONTEXT_MAX_CHARS,
  AO_USER_CONTEXT_PREFACE,
  loadAoUserContextBody,
  mainPersonaInjectsUserContext,
  prependAoUserContext,
} from "./ao-user-context";

test("empty body leaves the system prompt unchanged", () => {
  const system = "## 1. 指令概要\nそのまま";
  assert.equal(prependAoUserContext(system, ""), system);
  assert.equal(prependAoUserContext(system, "  \n"), system);
  assert.equal(prependAoUserContext(system, null), system);
  assert.equal(prependAoUserContext(system, undefined), system);
});

test("body is placed before the persona prompt with the fixed preface", () => {
  const system = "## 2. 思考方法\n主担当の思考";
  const body = "関心の軸は地政学である。\n応答は日本語。";
  const out = prependAoUserContext(system, body);
  assert.ok(out.startsWith(AO_USER_CONTEXT_PREFACE));
  assert.ok(out.includes(body));
  assert.ok(out.indexOf(body) < out.indexOf(system));
  assert.ok(out.endsWith(system));
});

test("body is trimmed and clipped to the table limit", () => {
  const long = "あ".repeat(AO_USER_CONTEXT_MAX_CHARS + 50);
  const out = prependAoUserContext("sp", `  ${long}  `);
  const clipped = out.slice(AO_USER_CONTEXT_PREFACE.length + 2, out.lastIndexOf("\n\nsp"));
  assert.equal(clipped.length, AO_USER_CONTEXT_MAX_CHARS);
  assert.equal(clipped.startsWith("あ"), true);
});

function fakeSupa(handlers: {
  ao_user_context?: () => Promise<{ data: { body?: unknown } | null; error: { message: string; code?: string } | null }>;
  ao_personas?: () => Promise<{ data: { inject_user_context?: unknown } | null; error: { message: string; code?: string } | null }>;
  throwOn?: string;
}): SupabaseClient {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq(column: string, value: string) {
              if (table === "ao_user_context") {
                assert.equal(column, "context_key");
                assert.equal(value, AO_USER_CONTEXT_KEY);
              }
              if (table === "ao_personas") {
                assert.equal(column, "persona_key");
              }
              return {
                maybeSingle: async () => {
                  if (handlers.throwOn === table) throw new Error("network down");
                  if (table === "ao_user_context") return handlers.ao_user_context!();
                  if (table === "ao_personas") return handlers.ao_personas!();
                  throw new Error(`unexpected table ${table}`);
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
    fakeSupa({ ao_user_context: async () => ({ data: { body: "立ち情報" }, error: null }) }),
  );
  assert.equal(body, "立ち情報");
});

test("load returns empty when the row or table is missing", async () => {
  assert.equal(
    await loadAoUserContextBody(fakeSupa({ ao_user_context: async () => ({ data: null, error: null }) })),
    "",
  );
  assert.equal(
    await loadAoUserContextBody(
      fakeSupa({
        ao_user_context: async () => ({
          data: null,
          error: { code: "PGRST205", message: "Could not find the table" },
        }),
      }),
    ),
    "",
  );
  assert.equal(
    await loadAoUserContextBody(fakeSupa({ throwOn: "ao_user_context" })),
    "",
  );
});

test("main persona flag defaults on unless the column is false", async () => {
  assert.equal(await mainPersonaInjectsUserContext(fakeSupa({}), ""), true);
  assert.equal(
    await mainPersonaInjectsUserContext(
      fakeSupa({ ao_personas: async () => ({ data: { inject_user_context: false }, error: null }) }),
      "persona_qete",
    ),
    false,
  );
  assert.equal(
    await mainPersonaInjectsUserContext(
      fakeSupa({ ao_personas: async () => ({ data: { inject_user_context: true }, error: null }) }),
      "persona_hunan",
    ),
    true,
  );
  assert.equal(
    await mainPersonaInjectsUserContext(
      fakeSupa({
        ao_personas: async () => ({
          data: null,
          error: { code: "42703", message: "column inject_user_context does not exist" },
        }),
      }),
      "persona_hunan",
    ),
    true,
  );
});
