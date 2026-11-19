export function EmptyState({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-soft text-brand">{icon}</div>
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      {children && <div className="mt-2 max-w-xs text-sm text-muted">{children}</div>}
    </div>
  );
}
