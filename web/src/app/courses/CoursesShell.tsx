"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function CoursesShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const isLearn = /\/courses\/[^/]+\/learn\/?$/.test(pathname);

  return (
    <div className={`cm-root ${isLearn ? "cm-root-learn" : ""}`}>
      <header className="cm-header">
        <div className="cm-header-inner">
          <Link href="/courses" className="cm-brand">
            講義メーカー
          </Link>
          {!isLearn && (
            <nav className="cm-nav">
              <Link href="/courses">一覧</Link>
              <Link href="/courses/new">新規作成</Link>
            </nav>
          )}
        </div>
      </header>
      <main className={`cm-main ${isLearn ? "cm-main-learn" : ""}`}>{children}</main>
    </div>
  );
}
