import sqlite3

conn = sqlite3.connect('/app/backend/data/webui.db')
cursor = conn.cursor()

# Get all tables
cursor.execute('SELECT name FROM sqlite_master WHERE type="table"')
tables = cursor.fetchall()
print("Tables:", tables)

# Check config table if it exists
if ('config',) in tables:
    cursor.execute('SELECT * FROM config')
    config = cursor.fetchall()
    print("Config:", config)

conn.close()
