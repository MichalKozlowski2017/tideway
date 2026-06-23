export function ArticleCardSkeleton() {
  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-zinc-950/5"
      aria-hidden
    >
      <div className="aspect-[16/10] animate-pulse bg-zinc-100" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex justify-between gap-2">
          <div className="h-3 w-16 animate-pulse rounded bg-zinc-100" />
          <div className="h-4 w-14 animate-pulse rounded-full bg-zinc-100" />
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full animate-pulse rounded bg-zinc-100" />
          <div className="h-3 w-11/12 animate-pulse rounded bg-zinc-100" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-100" />
        </div>
        <div className="mt-4 flex justify-between border-t border-zinc-100 pt-4">
          <div className="h-3 w-20 animate-pulse rounded bg-zinc-100" />
          <div className="h-4 w-24 animate-pulse rounded-full bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}
