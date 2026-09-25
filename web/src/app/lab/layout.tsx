export default function LabLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        height: "100%",
        overflow: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}
