-- Add message_id to track the WhatsApp message that created the expense
ALTER TABLE vehicle_expenses ADD COLUMN IF NOT EXISTS message_id TEXT;
