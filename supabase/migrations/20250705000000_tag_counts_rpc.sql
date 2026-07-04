-- Aggregate tags server-side (one small result set vs scanning all article rows client-side).
CREATE OR REPLACE FUNCTION get_tag_counts(p_locale text, p_min_count int DEFAULT 1)
RETURNS TABLE(name text, cnt bigint)
LANGUAGE sql
STABLE
AS $$
  SELECT tag AS name, COUNT(*)::bigint AS cnt
  FROM articles, unnest(tags) AS tag
  WHERE locale = p_locale
    AND is_published = true
    AND article_type = 'trend_item'
    AND tag IS NOT NULL
    AND length(trim(tag)) > 0
  GROUP BY tag
  HAVING COUNT(*) >= p_min_count
  ORDER BY cnt DESC, tag ASC;
$$;
