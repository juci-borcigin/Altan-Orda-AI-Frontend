import { oauthConfigured, signIn } from "@/auth";

function safeInternalPath(raw: string | undefined): string {
  if (!raw || !raw.startsWith("/")) return "/";
  return raw;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const callbackUrl = safeInternalPath(sp.callbackUrl);
  const err = sp.error;

  if (!oauthConfigured) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f4ee] p-6 font-serif text-[#3D1C08]">
        <h1 className="text-xl font-semibold">Altan Orda</h1>
        <p className="max-w-md text-center text-sm">
          Google OAuth が未設定です。環境変数{" "}
          <code className="rounded bg-black/5 px-1">AUTH_SECRET</code>・
          <code className="rounded bg-black/5 px-1">GOOGLE_CLIENT_ID</code>・
          <code className="rounded bg-black/5 px-1">GOOGLE_CLIENT_SECRET</code>
          を設定してください。
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f6f4ee] p-6 font-serif">
      <h1 className="text-xl font-semibold text-[#3D1C08]">Altan Orda</h1>
      {err === "AccessDenied" ? (
        <p className="max-w-md text-center text-sm text-red-900">
          この Google アカウントは許可されていません。
        </p>
      ) : null}
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: callbackUrl });
        }}
      >
        <button
          type="submit"
          className="cursor-pointer rounded-none border border-[#8D5400] bg-[#DBB961] px-6 py-2 text-sm font-semibold text-[#260f03] transition-[filter,transform] hover:brightness-105 active:scale-[0.98]"
        >
          Google でログイン
        </button>
      </form>
    </div>
  );
}
