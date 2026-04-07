/**
 * 全文受信後のタイプライター表示用（ストリーミングは別途）。
 * 長文は 1 ティックあたりの文字数を少し増やして待ち時間を抑える。
 */

export type TypewriterOptions = {
  /** 各ティック後に false を返すと打ち切り */
  isAlive?: () => boolean;
};

function charsPerTick(totalLen: number, pos: number): number {
  if (totalLen <= 0) return 1;
  if (totalLen > 4000) return 12;
  if (totalLen > 1500) return 6;
  if (totalLen > 400) return 3;
  return 2;
}

export async function runTypewriter(
  fullText: string,
  onProgress: (visible: string) => void,
  options?: TypewriterOptions,
): Promise<void> {
  const isAlive = options?.isAlive ?? (() => true);
  const n = fullText.length;
  let i = 0;
  while (i < n) {
    if (!isAlive()) return;
    const step = Math.min(charsPerTick(n, i), n - i);
    i += step;
    onProgress(fullText.slice(0, i));
    if (i < n) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 14);
      });
    }
  }
}
