export default function PageShell({
  title,
  children,
}: {
  /** Deprecated: eyebrows removed from static pages. Kept for API compat. */
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="animate-in">
      <h1 className="text-title-2xl font-extrabold text-fg tracking-tight leading-[1.05] mb-6">
        {title}
      </h1>
      <div className="prose-clinicle">{children}</div>
    </article>
  );
}
