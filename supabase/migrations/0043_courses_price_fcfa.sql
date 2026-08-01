-- One-time currency migration: courses.price was USD-style (e.g. 29.99),
-- charged as real USD cents via Stripe. Founder decision (2026-08-01,
-- Batch 2 of the beta-readiness roadmap): auto-convert existing prices to
-- FCFA once at a fixed approximate rate (~600 FCFA/$1), then all future
-- instructor input is treated as FCFA directly -- no more USD math after
-- this. Real payment processing is separately gated off for V1 via
-- lib/paymentsConfig.ts's PAYMENTS_ENABLED flag, so no live charge is
-- affected by this migration; it's purely a display/data-correctness fix
-- ahead of payments being re-enabled.
update courses
set price = round(price * 600)
where price > 0;

comment on column courses.price is 'Price in FCFA (whole units, zero-decimal currency) -- migrated from USD on 2026-08-01, see 0043_courses_price_fcfa.sql. Not cents.';
