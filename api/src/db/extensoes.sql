-- Roda uma vez, na criação do banco.
-- pgcrypto: gen_random_uuid e funções de hash.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- unaccent: busca que ignora acento, essencial em português.
CREATE EXTENSION IF NOT EXISTS unaccent;
-- pg_trgm: busca por semelhança, para "quem sabe você quis dizer".
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Configuração de busca textual em português que também ignora acento.
-- Sem isso, procurar "oracao" não acha "oração".
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'portugues_sem_acento') THEN
    CREATE TEXT SEARCH CONFIGURATION portugues_sem_acento (COPY = portuguese);
    ALTER TEXT SEARCH CONFIGURATION portugues_sem_acento
      ALTER MAPPING FOR hword, hword_part, word WITH unaccent, portuguese_stem;
  END IF;
END
$$;
