import sqlite3

conn = sqlite3.connect('/app/backend/data/webui.db')
cursor = conn.cursor()

# Delete old model
cursor.execute('DELETE FROM model WHERE id = "law-assistant:latest"')
conn.commit()

# Verify
cursor.execute('SELECT * FROM model')
models = cursor.fetchall()
print("Models after deletion:", models)

conn.close()
print("Old model deleted successfully")
