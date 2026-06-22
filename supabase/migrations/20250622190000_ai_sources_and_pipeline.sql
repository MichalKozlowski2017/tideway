-- More AI RSS sources + Lobsters AI tag for locale pl

INSERT INTO sources (type, config, category, locale, enabled)
SELECT v.type::source_type, v.config::jsonb, v.category, v.locale, v.enabled
FROM (VALUES
  ('rss', '{"feedUrl": "https://techcrunch.com/category/artificial-intelligence/feed/"}', 'ai', 'pl', true),
  ('rss', '{"feedUrl": "https://venturebeat.com/category/ai/feed/"}', 'ai', 'pl', true),
  ('rss', '{"feedUrl": "https://www.artificialintelligence-news.com/feed/"}', 'ai', 'pl', true),
  ('rss', '{"feedUrl": "https://huggingface.co/blog/feed.xml"}', 'ai', 'pl', true),
  ('rss', '{"feedUrl": "https://spidersweb.pl/kategoria/sztuczna-inteligencja/feed/"}', 'ai', 'pl', true),
  ('rss', '{"feedUrl": "https://antyweb.pl/kategoria/ai/feed/"}', 'ai', 'pl', true),
  ('rss', '{"feedUrl": "https://hnrss.org/newest?q=machine+learning&points=40"}', 'ai', 'pl', true),
  ('lobsters', '{"tag": "ai"}', 'ai', 'pl', true)
) AS v(type, config, category, locale, enabled)
WHERE NOT EXISTS (
  SELECT 1 FROM sources s
  WHERE s.type::text = v.type
    AND s.config = v.config::jsonb
    AND s.locale = v.locale
);
