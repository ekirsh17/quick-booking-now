-- Seed OpenAlert pricing into plans table

INSERT INTO public.plans (
  id,
  name,
  monthly_price,
  annual_price,
  stripe_product_id,
  stripe_price_id,
  stripe_annual_price_id,
  is_active,
  display_order
)
VALUES (
  'starter',
  'OpenAlert',
  1200,
  10800,
  'prod_To56wjlYlTEuC5',
  'price_1SqSvwGXlKB5nE0whqwMF8h9',
  'price_1SqTURGXlKB5nE0wCBcgK7sV',
  true,
  1
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price = EXCLUDED.monthly_price,
  annual_price = EXCLUDED.annual_price,
  stripe_product_id = EXCLUDED.stripe_product_id,
  stripe_price_id = EXCLUDED.stripe_price_id,
  stripe_annual_price_id = EXCLUDED.stripe_annual_price_id,
  is_active = EXCLUDED.is_active,
  display_order = EXCLUDED.display_order,
  updated_at = now();
