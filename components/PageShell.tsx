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
      <h1 className="text-lede sm:text-title-sm font-bold uppercase tracking-[0.06em] text-fg leading-tight pb-3 mb-5 border-b border-border">
        {title}
      </h1>
      <div className="prose-clinicle">{children}</div>
    </article>
  );
}
