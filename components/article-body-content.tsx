import { parseBodyBlocks } from "@/lib/ai/article-body";
import { ArticleCodeBlock } from "@/components/article-code-block";

function ParagraphText({ text }: { text: string }) {
  const parts = text.split(/(`[^`\n]+`)/g);

  return (
    <p>
      {parts.map((part, index) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code
            key={`${index}-${part}`}
            className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.88em] text-zinc-800 ring-1 ring-zinc-200/80"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={`${index}-${part.slice(0, 12)}`}>{part}</span>
        ),
      )}
    </p>
  );
}

export async function ArticleBodyContent({
  body,
  longRead,
}: {
  body: string;
  longRead: boolean;
}) {
  const blocks = parseBodyBlocks(body);

  const rendered = await Promise.all(
    blocks.map(async (block, index) => {
      if (block.type === "heading") {
        return (
          <h2
            key={`h-${index}-${block.text}`}
            className="pt-2 text-xl font-semibold tracking-tight text-zinc-900"
          >
            {block.text}
          </h2>
        );
      }

      if (block.type === "code") {
        return (
          <ArticleCodeBlock
            key={`c-${index}-${block.language}`}
            code={block.code}
            language={block.language}
          />
        );
      }

      return (
        <ParagraphText
          key={`p-${index}-${block.text.slice(0, 48)}`}
          text={block.text}
        />
      );
    }),
  );

  return (
    <div
      className={
        longRead
          ? "space-y-6 text-[1.125rem] leading-[1.85] text-zinc-700"
          : "space-y-5 text-[1.0625rem] leading-[1.75] text-zinc-700"
      }
    >
      {rendered}
    </div>
  );
}
