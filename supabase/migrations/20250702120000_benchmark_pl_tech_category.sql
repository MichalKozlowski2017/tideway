-- benchmark.pl is a hardware/tech site, not gaming
UPDATE sources
SET category = 'tech'
WHERE type = 'rss'
  AND (
    config->>'feedUrl' LIKE '%benchmark.pl%'
  );
