import sqlite3

conn = sqlite3.connect('/app/backend/data/webui.db')
cursor = conn.cursor()

# Check model table
cursor.execute('SELECT * FROM model')
models = cursor.fetchall()
print("Models in database:", models)

conn.close()
