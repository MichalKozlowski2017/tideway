export function PageHeader({
  title,
  description,
  meta,
}: {
  title: string;
  description?: string;
  meta?: string;
}) {
  return (
    <header className="mb-10">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 md:text-4xl">
        {title}
      </h1>
      {description && (
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-zinc-500">
          {description}
        </p>
      )}
      {meta && <p className="mt-2 text-sm text-zinc-400">{meta}</p>}
    </header>
  );
}
