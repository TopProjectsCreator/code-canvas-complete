-- Redactor image redaction: add redact_images toggle to proxy keys

ALTER TABLE redactor_proxy_keys ADD COLUMN IF NOT EXISTS redact_images boolean NOT NULL DEFAULT true;
