INSERT INTO organization_settings (key, value)
VALUES ('delivery_points', '[]')
ON CONFLICT (key) DO NOTHING;