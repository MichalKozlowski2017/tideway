-- Google Trends rising queries per category (PL)
INSERT INTO sources (type, config, category, locale, enabled)
SELECT v.type::source_type, v.config::jsonb, v.category, v.locale, v.enabled
FROM (VALUES
  ('google_trends', '{"geo": "PL", "keyword": "sztuczna inteligencja", "includeDaily": "false"}', 'ai', 'pl', true),
  ('google_trends', '{"geo": "PL", "keyword": "gra", "includeDaily": "false"}', 'gaming', 'pl', true),
  ('google_trends', '{"geo": "PL", "keyword": "piłka nożna", "includeDaily": "true"}', 'sport', 'pl', true),
  ('google_trends', '{"geo": "PL", "keyword": "technologia", "includeDaily": "false"}', 'tech', 'pl', true),
  ('google_trends', '{"geo": "PL", "keyword": "programowanie", "includeDaily": "false"}', 'it', 'pl', true),
  ('google_trends', '{"geo": "PL", "keyword": "giełda", "includeDaily": "false"}', 'finance', 'pl', true)
) AS v(type, config, category, locale, enabled)
WHERE NOT EXISTS (
  SELECT 1 FROM sources s
  WHERE s.type = v.type::source_type
    AND s.category = v.category
    AND s.locale = v.locale
);
