import sqlite3

conn = sqlite3.connect('/app/backend/data/webui.db')
cursor = conn.cursor()

# Get schema of config table
cursor.execute('PRAGMA table_info(config)')
schema = cursor.fetchall()
print("Config table schema:", schema)

conn.close()
