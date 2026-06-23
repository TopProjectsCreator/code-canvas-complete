-- Redactor video redaction: add redact_videos toggle to proxy keys

ALTER TABLE redactor_proxy_keys ADD COLUMN IF NOT EXISTS redact_videos boolean NOT NULL DEFAULT true;
