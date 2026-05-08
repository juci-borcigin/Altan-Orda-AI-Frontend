import { signIn } from "@/auth";

export async function GET() {
  // Google OAuth へリダイレクト（成功後はトップへ）
  await signIn("google", { redirectTo: "/" });
}

