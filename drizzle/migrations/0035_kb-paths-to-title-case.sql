-- Migrate KB paths from lowercase/kebab-case to Title Case
-- profile.identity → Profile.Identity
-- knowledge.preferences.browser-automation → Knowledge.Preferences.Browser Automation

UPDATE documents
SET path = (
    SELECT string_agg(initcap(replace(segment, '-', ' ')), '.')
    FROM unnest(string_to_array(path, '.')) AS segment
)
WHERE path ~ '[a-z]';  -- Only update paths that contain lowercase letters
