import sqlite3
import json

conn = sqlite3.connect('/app/backend/data/webui.db')
cursor = conn.cursor()

# Get current config
cursor.execute('SELECT * FROM config')
current_config = cursor.fetchall()
print("Current config:", current_config)

# New config with Ollama enabled
new_config = {
    "version": 0,
    "ui": {"enable_signup": False},
    "ollama": {
        "enable": True,
        "base_urls": ["http://host.docker.internal:11434"],
        "api_configs": {}
    },
    "openai": {
        "enable": False,
        "api_base_urls": [],
        "api_keys": [],
        "api_configs": {}
    },
    "evaluation": {"arena": {"enable": False}}
}

# Update config (column name is 'data' not 'config')
cursor.execute('UPDATE config SET data = ? WHERE id = 1', (json.dumps(new_config),))
conn.commit()

# Verify update
cursor.execute('SELECT * FROM config')
updated_config = cursor.fetchall()
print("Updated config:", updated_config)

conn.close()
print("Config updated successfully")
