-- Migration 001 — richer AI call log (for the in-app "AI call log" viewer).
-- Run once in Supabase SQL editor. Safe to re-run (IF NOT EXISTS).
-- Adds: input/output token split, call duration, success/failure status.
-- New schema installs get these from db/schema.sql directly.

alter table recommendation_logs
  add column if not exists prompt_tokens     integer,
  add column if not exists completion_tokens integer,
  add column if not exists duration_ms       integer,
  add column if not exists status            text not null default 'success',
  add column if not exists error_text        text;

alter table taste_verdict_logs
  add column if not exists prompt_tokens     integer,
  add column if not exists completion_tokens integer,
  add column if not exists duration_ms       integer,
  add column if not exists status            text not null default 'success',
  add column if not exists error_text        text;
