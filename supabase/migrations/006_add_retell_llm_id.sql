-- Add retell_llm_id column to firms table
-- Each firm gets its own Retell LLM resource where the prompt lives
ALTER TABLE firms ADD COLUMN IF NOT EXISTS retell_llm_id TEXT;
