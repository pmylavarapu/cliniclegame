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
      {eyebrow && (
        <div className="text-[11px] uppercase tracking-[0.16em] text-muted font-bold mb-2">
          {eyebrow}
        </div>
      )}
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-6">
        {title}
      </h1>
      <div className="prose-clinicle">{children}</div>
    </article>
  );
}
