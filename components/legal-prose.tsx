import type { ReactNode } from "react";

export function LegalProse({ children }: { children: ReactNode }) {
  return (
    <div className="prose-legal space-y-8 text-[1.0625rem] leading-relaxed text-zinc-700">
      {children}
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}
