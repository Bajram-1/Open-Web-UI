import sqlite3

conn = sqlite3.connect('data/webui.db')
cursor = conn.cursor()

# Get all tables
cursor.execute('SELECT name FROM sqlite_master WHERE type="table"')
tables = cursor.fetchall()
print("Tables:", tables)

# If there's a message or chat table, let's look at it
for table in tables:
    table_name = table[0]
    print(f"\nTable: {table_name}")
    cursor.execute(f'PRAGMA table_info({table_name})')
    columns = cursor.fetchall()
    print("Columns:", columns)

conn.close()
