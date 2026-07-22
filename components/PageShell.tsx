export default function PageShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="animate-in">
      <div className="flex items-baseline justify-between gap-4 pb-3 mb-8 border-b border-border">
        <div className="flex items-baseline gap-3">
          {eyebrow && (
            <span className="text-eyebrow uppercase text-muted font-semibold">
              {eyebrow}
            </span>
          )}
          <h1 className="text-title-lg font-semibold text-fg tracking-tight leading-none">
            {title}
          </h1>
        </div>
      </div>
      <div className="prose-clinicle">{children}</div>
    </article>
  );
}
