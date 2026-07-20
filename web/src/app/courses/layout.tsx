import type { Metadata } from "next";
import "./courses.css";
import { CoursesShell } from "./CoursesShell";

export const metadata: Metadata = {
  title: "講習メーカー",
  description: "独立モジュール — 講座の作成・受講",
};

export default function CoursesLayout({ children }: { children: React.ReactNode }) {
  return <CoursesShell>{children}</CoursesShell>;
}
