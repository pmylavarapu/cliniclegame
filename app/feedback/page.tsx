import type { Metadata } from 'next';
import PageShell from '@/components/PageShell';

export const metadata: Metadata = {
  title: 'Feedback – Clinicle',
  description: 'Report a bad prompt, a scoring quirk, or just say hello.',
};

export default function FeedbackPage() {
  return (
    <PageShell eyebrow="Get in touch" title="Feedback">
      <p>
        Found a prompt that gives the answer away? Spotted a diagnosis you
        think shouldn&apos;t be in the pool? Have a feature request or just
        want to say hi? Any of the below works.
      </p>

      <div className="not-prose mt-6 grid gap-3 sm:grid-cols-2">
        <FeedbackLink
          href="https://github.com/pmylavarapu/cliniclegame/issues/new"
          title="Open an issue"
          subtitle="Best for bugs and specific puzzles"
        />
        <FeedbackLink
          href="mailto:praneet.mylavarapu@gmail.com?subject=Clinicle%20feedback"
          title="Email"
          subtitle="praneet.mylavarapu@gmail.com"
        />
        <FeedbackLink
          href="https://twitter.com/intent/tweet?text=@ClinicleGame%20"
          title="Twitter / X"
          subtitle="@ClinicleGame"
        />
        <FeedbackLink
          href="https://github.com/pmylavarapu/cliniclegame"
          title="Read the source"
          subtitle="pmylavarapu/cliniclegame"
        />
      </div>

      <h2 className="mt-10">Reporting a bad prompt</h2>
      <p>
        If a prompt reveals the answer or an unambiguous eponym, please
        include the puzzle number (visible in the intro line) and the exact
        prompt text so we can regenerate that day.
      </p>
    </PageShell>
  );
}

function FeedbackLink({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group rounded-md border border-border bg-white px-4 py-3 hover:border-primary hover:shadow-card transition-all no-underline"
    >
      <div className="text-title-sm text-fg font-semibold group-hover:text-primary transition-colors">
        {title}
      </div>
      <div className="text-caption text-muted mt-0.5">{subtitle}</div>
    </a>
  );
}
