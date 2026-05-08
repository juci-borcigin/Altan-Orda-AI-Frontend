import { signOut } from "@/auth";

export async function POST() {
  // セッション破棄（成功後はサインイン画面へ）
  await signOut({ redirectTo: "/sign-in" });
}

