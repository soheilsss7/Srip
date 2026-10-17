-- PostgreSQL 18 marks enum->text I/O casts as STABLE, which disallows them
-- inside GIN/tsvector INDEX expressions. This immutable wrapper preserves the
-- intended full-text index definitions across PG versions.
CREATE OR REPLACE FUNCTION srip_enum_text(v anyenum) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT v::text $$;
