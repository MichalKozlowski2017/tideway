-- Boost AI article volume: new feeds, lower hnrss thresholds, disable duplicate HN AI

INSERT INTO sources (type, config, category, locale, enabled)
SELECT v.type::source_type, v.config::jsonb, v.category, v.locale, v.enabled
FROM (VALUES
  ('rss', '{"feedUrl": "https://www.theverge.com/ai-artificial-intelligence/rss/index.xml"}', 'ai', 'pl', true),
  ('rss', '{"feedUrl": "https://blogs.nvidia.com/feed/"}', 'ai', 'pl', true),
  ('rss', '{"feedUrl": "https://www.marktechpost.com/feed/"}', 'ai', 'pl', true)
) AS v(type, config, category, locale, enabled)
WHERE NOT EXISTS (
  SELECT 1 FROM sources s
  WHERE s.type::text = v.type
    AND s.config = v.config::jsonb
    AND s.locale = v.locale
);

-- HN AI duplicated technology topstories — same stories, often skipped as duplicates
UPDATE sources
SET enabled = false
WHERE type = 'hacker_news'
  AND category = 'ai'
  AND config->>'list' = 'topstories';

-- More hnrss AI items (lower engagement bar)
UPDATE sources
SET config = jsonb_set(config, '{feedUrl}', '"https://hnrss.org/newest?q=machine+learning&points=20"')
WHERE type = 'rss'
  AND category = 'ai'
  AND config->>'feedUrl' = 'https://hnrss.org/newest?q=machine+learning&points=40';

UPDATE sources
SET config = jsonb_set(config, '{feedUrl}', '"https://hnrss.org/newest?q=AI+OR+LLM&points=20"')
WHERE type = 'rss'
  AND category = 'ai'
  AND config->>'feedUrl' = 'https://hnrss.org/newest?q=AI+OR+LLM&points=30';
