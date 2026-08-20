import { redirect } from "next/navigation";

/** 旧部品ギャラリー。正本はテンプレ・トークン台帳。 */
export default function Phase5PreviewRedirectPage() {
  redirect("/lab/template-tokens");
}
