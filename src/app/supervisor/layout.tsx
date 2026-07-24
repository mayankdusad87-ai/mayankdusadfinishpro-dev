export default function SupervisorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy-dark">
      {children}
    </div>
  );
}
