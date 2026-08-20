import Link from "next/link";
import { AoTemplateTokenCatalog } from "@/components/ao-phase5/AoTemplateTokenCatalog";

export const metadata = {
  title: "テンプレ・トークン台帳 | 実験室",
  description: "枠・ラベルの 9-slice 部品と組み合わせの視覚 SSOT",
};

export default function TemplateTokensPage() {
  return (
    <div className="min-h-full bg-[#ede3ce]">
      <div className="border-b border-[#c9922a]/40 bg-[#f5edd6] px-4 py-2">
        <Link href="/lab" className="text-[12px] text-[#6a3f0a] underline-offset-2 hover:underline">
          ← 実験室
        </Link>
      </div>
      <AoTemplateTokenCatalog />
    </div>
  );
}
