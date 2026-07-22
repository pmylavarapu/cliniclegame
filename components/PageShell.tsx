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
      <div className="mb-6">
        {eyebrow && (
          <div className="text-eyebrow uppercase text-muted font-bold tracking-[0.06em] mb-3">
            {eyebrow}
          </div>
        )}
        <h1 className="text-title-2xl font-bold text-fg tracking-tight leading-tight">
          {title}
        </h1>
      </div>
      <div className="prose-clinicle">{children}</div>
    </article>
  );
}
