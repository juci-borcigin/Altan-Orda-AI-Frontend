import type { Metadata } from "next";
import "../courses/courses.css";

export const metadata: Metadata = {
  title: "講義",
  description: "講義の受講",
};

/** 公開受講専用。管理ナビ・一覧・新規作成は出さない */
export default function PublicLearnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cm-root cm-root-learn">
      <header className="cm-header">
        <div className="cm-header-inner">
          <span className="cm-brand">講義</span>
        </div>
      </header>
      <main className="cm-main cm-main-learn">{children}</main>
    </div>
  );
}
