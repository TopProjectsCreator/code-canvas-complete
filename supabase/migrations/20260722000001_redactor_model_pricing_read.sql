-- Allow authenticated users to read model pricing for the chat dropdown
CREATE POLICY "authenticated can read model pricing"
  ON redactor_model_pricing
  FOR SELECT
  TO authenticated
  USING (true);
