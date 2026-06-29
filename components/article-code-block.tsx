import { codeToHtml } from "shiki";

const SUPPORTED_LANGS = new Set([
  "bash",
  "c",
  "cpp",
  "css",
  "go",
  "html",
  "java",
  "javascript",
  "js",
  "json",
  "kotlin",
  "php",
  "python",
  "ruby",
  "rust",
  "shell",
  "sql",
  "swift",
  "text",
  "ts",
  "tsx",
  "typescript",
  "yaml",
]);

function normalizeLanguage(language: string): string {
  const lang = language.trim().toLowerCase() || "text";
  if (lang === "js") return "javascript";
  if (lang === "ts") return "typescript";
  if (lang === "sh") return "bash";
  return SUPPORTED_LANGS.has(lang) ? lang : "text";
}

export async function ArticleCodeBlock({
  code,
  language,
}: {
  code: string;
  language: string;
}) {
  const lang = normalizeLanguage(language);
  let html: string;

  try {
    html = await codeToHtml(code, {
      lang,
      theme: "github-light",
    });
  } catch {
    html = await codeToHtml(code, {
      lang: "text",
      theme: "github-light",
    });
  }

  const label = language.trim() || lang;

  return (
    <figure className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 shadow-sm ring-1 ring-zinc-950/5">
      {label !== "text" && (
        <figcaption className="border-b border-zinc-200 bg-zinc-100/90 px-4 py-2 font-mono text-[0.7rem] font-medium uppercase tracking-widest text-zinc-500">
          {label}
        </figcaption>
      )}
      <div
        className="article-code overflow-x-auto p-4 text-[0.8125rem] leading-[1.65] [&_pre]:m-0 [&_pre]:bg-transparent [&_code]:font-mono"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </figure>
  );
}
