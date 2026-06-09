/** 初回ナビゲーション中のプレースホルダ（本編 Hydration 前の体感短縮） */
export default function Loading() {
  return (
    <div
      className="flex h-[100dvh] max-h-[100dvh] flex-col items-center justify-center bg-[#133D5C] font-serif text-[#DBB961]"
      aria-busy="true"
      aria-label="読み込み中"
    >
      <span className="text-[13px] font-semibold tracking-[0.2em]">Altan Orda</span>
    </div>
  );
}
