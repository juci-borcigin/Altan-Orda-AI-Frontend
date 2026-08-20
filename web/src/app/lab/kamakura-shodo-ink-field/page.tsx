import type { Metadata } from "next";
import { KamakuraInkFieldSite } from "./site";
import "./ink-field.css";

export const metadata: Metadata = {
  title: "鎌倉書道 · Ink Field 試作 | 実験室",
  description:
    "Kamakura Culture Studio — 二言語対応・モダン刷新版・モバイル対応。ヒーローは外国人書道体験写真。",
};

export default function KamakuraInkFieldPage() {
  return <KamakuraInkFieldSite />;
}
