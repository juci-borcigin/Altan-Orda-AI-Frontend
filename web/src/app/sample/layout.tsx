/** sample/* はルート body が overflow-hidden のため、ここで縦スクロールを確保する */
export default function SampleLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  );
}
