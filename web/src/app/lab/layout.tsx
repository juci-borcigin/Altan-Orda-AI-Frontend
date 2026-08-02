import type { Metadata } from "next";
import "./lab.css";

export const metadata: Metadata = {
  title: "実験室 | Altan Orda",
  description: "Altan Orda の開発・比較・PoC 公式エリア",
};

/** /lab/* はルート body が overflow-hidden のため、ここで縦スクロールを確保する */
export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  );
}
