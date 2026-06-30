-- Split technology into tech (gadgets/products) and it (developer news)

-- 1. Move developer-focused sources to IT
UPDATE sources
SET category = 'it'
WHERE category = 'technology'
  AND (
    type IN ('hacker_news', 'lobsters')
    OR config->>'feedUrl' IN (
      'https://dev.to/feed',
      'https://www.theregister.com/headlines.atom',
      'https://feeds.feedburner.com/TheHackersNews',
      'https://hnrss.org/newest?q=security&points=50'
    )
  );

-- 2. Remaining technology sources → Tech
UPDATE sources SET category = 'tech' WHERE category = 'technology';

-- 3. Reclassify articles by primary source (first source_item_id)
UPDATE articles a
SET category = 'it'
WHERE a.category = 'technology'
  AND cardinality(a.source_item_ids) > 0
  AND EXISTS (
    SELECT 1
    FROM raw_items ri
    JOIN sources s ON s.id = ri.source_id
    WHERE ri.id = a.source_item_ids[1]
      AND s.category = 'it'
  );

-- 4. Digests and remainder → Tech
UPDATE articles SET category = 'tech' WHERE category = 'technology';
