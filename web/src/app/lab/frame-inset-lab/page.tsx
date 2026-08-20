import Link from "next/link";
import { AoFrameInsetLab } from "@/components/ao-phase5/AoFrameInsetLab";

export const metadata = {
  title: "枠インセット診断 | 実験室",
  description: "大枠・中枠・顔グラの border-image インセット可視化",
};

export default function FrameInsetLabPage() {
  return (
    <div className="min-h-full bg-[#ede3ce]">
      <div className="border-b border-[#c9922a]/40 bg-[#f5edd6] px-4 py-2">
        <Link href="/lab" className="text-[12px] text-[#6a3f0a] underline-offset-2 hover:underline">
          ← 実験室
        </Link>
      </div>
      <AoFrameInsetLab />
    </div>
  );
}
