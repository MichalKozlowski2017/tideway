-- Tier 1 RSS sources: tech, AI, gaming, sport, finance (locale pl)

INSERT INTO sources (type, config, category, locale, enabled)
SELECT v.type::source_type, v.config::jsonb, v.category, v.locale, v.enabled
FROM (VALUES
  ('rss', '{"feedUrl": "https://dev.to/feed"}', 'technology', 'pl', true),
  ('rss', '{"feedUrl": "https://www.theregister.com/headlines.atom"}', 'technology', 'pl', true),
  ('rss', '{"feedUrl": "https://feeds.feedburner.com/TheHackersNews"}', 'technology', 'pl', true),
  ('rss', '{"feedUrl": "https://hnrss.org/newest?q=security&points=50"}', 'technology', 'pl', true),
  ('rss', '{"feedUrl": "https://www.chip.pl/rss/"}', 'technology', 'pl', true),
  ('rss', '{"feedUrl": "https://www.dobreprogramy.pl/rss/aktualnosci"}', 'technology', 'pl', true),
  ('rss', '{"feedUrl": "https://blog.google/technology/ai/rss/"}', 'ai', 'pl', true),
  ('rss', '{"feedUrl": "https://openai.com/blog/rss.xml"}', 'ai', 'pl', true),
  ('rss', '{"feedUrl": "https://hnrss.org/newest?q=AI+OR+LLM&points=30"}', 'ai', 'pl', true),
  ('rss', '{"feedUrl": "https://www.pcgamer.com/rss/"}', 'gaming', 'pl', true),
  ('rss', '{"feedUrl": "https://www.gamespot.com/feeds/mashup/"}', 'gaming', 'pl', true),
  ('rss', '{"feedUrl": "https://www.ign.com/rss/articles/feed"}', 'gaming', 'pl', true),
  ('rss', '{"feedUrl": "https://www.gry-online.pl/rss/news.xml"}', 'gaming', 'pl', true),
  ('rss', '{"feedUrl": "https://www.espn.com/espn/rss/news"}', 'sport', 'pl', true),
  ('rss', '{"feedUrl": "https://feeds.bbci.co.uk/sport/rss.xml"}', 'sport', 'pl', true),
  ('rss', '{"feedUrl": "https://www.coindesk.com/arc/outboundfeeds/rss/"}', 'finance', 'pl', true),
  ('rss', '{"feedUrl": "https://feeds.bloomberg.com/markets/news.rss"}', 'finance', 'pl', true),
  ('rss', '{"feedUrl": "https://www.bankier.pl/rss/wiadomosci.xml"}', 'finance', 'pl', true)
) AS v(type, config, category, locale, enabled)
WHERE NOT EXISTS (
  SELECT 1 FROM sources s
  WHERE s.type = v.type
    AND s.config->>'feedUrl' = v.config::jsonb->>'feedUrl'
    AND s.locale = v.locale
);
