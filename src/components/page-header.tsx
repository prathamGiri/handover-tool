export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-4 pb-4 pt-6">
      <div className="min-w-0">
        {subtitle && <p className="truncate text-sm text-muted">{subtitle}</p>}
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  );
}
