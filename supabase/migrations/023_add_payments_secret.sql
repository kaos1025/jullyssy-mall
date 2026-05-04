-- Add secret column for Toss webhook verification
-- Reference: https://docs.tosspayments.com/reference/using-api/webhook-events
-- The secret value comes from Toss /v1/payments/confirm response and must be
-- compared against incoming PAYMENT_STATUS_CHANGED webhook body's secret field.

ALTER TABLE payments
  ADD COLUMN secret TEXT;

COMMENT ON COLUMN payments.secret IS 'Toss Payments webhook verification secret. Stored from confirm API response, compared with PAYMENT_STATUS_CHANGED webhook body.';
