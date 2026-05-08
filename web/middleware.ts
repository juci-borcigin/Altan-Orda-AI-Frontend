import { auth } from "@/auth";

/** OAuth / Basic の判定は `auth.ts` の `callbacks.authorized` に集約 */
export default auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
