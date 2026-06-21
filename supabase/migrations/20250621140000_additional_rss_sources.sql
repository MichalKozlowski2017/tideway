-- Additional RSS feeds: international depth + Polish originals for locale=pl

INSERT INTO sources (type, config, category, locale, enabled)
SELECT 'rss', '{"feedUrl": "https://feeds.arstechnica.com/arstechnica/index"}', 'technology', 'pl', true
WHERE NOT EXISTS (
  SELECT 1 FROM sources
  WHERE type = 'rss' AND config->>'feedUrl' = 'https://feeds.arstechnica.com/arstechnica/index'
);

INSERT INTO sources (type, config, category, locale, enabled)
SELECT 'rss', '{"feedUrl": "https://www.wired.com/feed/rss"}', 'technology', 'pl', true
WHERE NOT EXISTS (
  SELECT 1 FROM sources
  WHERE type = 'rss' AND config->>'feedUrl' = 'https://www.wired.com/feed/rss'
);

INSERT INTO sources (type, config, category, locale, enabled)
SELECT 'rss', '{"feedUrl": "https://www.technologyreview.com/feed/"}', 'ai', 'pl', true
WHERE NOT EXISTS (
  SELECT 1 FROM sources
  WHERE type = 'rss' AND config->>'feedUrl' = 'https://www.technologyreview.com/feed/'
);

INSERT INTO sources (type, config, category, locale, enabled)
SELECT 'rss', '{"feedUrl": "https://www.polygon.com/rss/index.xml"}', 'gaming', 'pl', true
WHERE NOT EXISTS (
  SELECT 1 FROM sources
  WHERE type = 'rss' AND config->>'feedUrl' = 'https://www.polygon.com/rss/index.xml'
);

INSERT INTO sources (type, config, category, locale, enabled)
SELECT 'rss', '{"feedUrl": "https://spidersweb.pl/feed"}', 'technology', 'pl', true
WHERE NOT EXISTS (
  SELECT 1 FROM sources
  WHERE type = 'rss' AND config->>'feedUrl' = 'https://spidersweb.pl/feed'
);

INSERT INTO sources (type, config, category, locale, enabled)
SELECT 'rss', '{"feedUrl": "https://antyweb.pl/feed"}', 'technology', 'pl', true
WHERE NOT EXISTS (
  SELECT 1 FROM sources
  WHERE type = 'rss' AND config->>'feedUrl' = 'https://antyweb.pl/feed'
);

INSERT INTO sources (type, config, category, locale, enabled)
SELECT 'rss', '{"feedUrl": "https://www.benchmark.pl/rss/benchmark-pl.xml"}', 'gaming', 'pl', true
WHERE NOT EXISTS (
  SELECT 1 FROM sources
  WHERE type = 'rss' AND config->>'feedUrl' = 'https://www.benchmark.pl/rss/benchmark-pl.xml'
);

-- EN mirrors for key international feeds
INSERT INTO sources (type, config, category, locale, enabled)
SELECT 'rss', '{"feedUrl": "https://feeds.arstechnica.com/arstechnica/index"}', 'technology', 'en', true
WHERE NOT EXISTS (
  SELECT 1 FROM sources
  WHERE type = 'rss' AND config->>'feedUrl' = 'https://feeds.arstechnica.com/arstechnica/index' AND locale = 'en'
);

INSERT INTO sources (type, config, category, locale, enabled)
SELECT 'rss', '{"feedUrl": "https://www.technologyreview.com/feed/"}', 'ai', 'en', true
WHERE NOT EXISTS (
  SELECT 1 FROM sources
  WHERE type = 'rss' AND config->>'feedUrl' = 'https://www.technologyreview.com/feed/' AND locale = 'en'
);
