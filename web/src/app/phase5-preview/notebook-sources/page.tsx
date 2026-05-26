import Link from "next/link";
import { AoNotebookSourcesLab } from "@/components/notebook/AoNotebookSourcesLab";

export default function NotebookSourcesPreviewPage() {
  return (
    <div className="min-h-screen px-4 py-6" style={{ background: "#e8dcc8" }}>
      <p className="mx-auto mb-4 max-w-4xl text-[11px]">
        <Link href="/phase5-preview" className="underline" style={{ color: "#3D1C08" }}>
          ← Phase5 Preview へ
        </Link>
      </p>
      <AoNotebookSourcesLab />
    </div>
  );
}
