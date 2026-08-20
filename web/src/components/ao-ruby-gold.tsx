"use client";

export function AoRubyGold({
  main,
  rt,
  mainClassName = "font-serif text-[#DBB961]",
  rtClassName = "font-serif text-[8px] text-[#DBB961]/80",
}: {
  main: string;
  rt: string;
  mainClassName?: string;
  rtClassName?: string;
}) {
  return (
    <ruby className={`inline-ruby ${mainClassName}`}>
      {main}
      <rt className={rtClassName}>{rt}</rt>
    </ruby>
  );
}
