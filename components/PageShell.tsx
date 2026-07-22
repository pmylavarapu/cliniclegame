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
        <div className="text-eyebrow uppercase text-muted font-semibold mb-3">
          {eyebrow}
        </div>
      )}
      <h1 className="text-title-xl font-semibold text-fg mb-6">{title}</h1>
      <div className="prose-clinicle">{children}</div>
    </article>
  );
}
