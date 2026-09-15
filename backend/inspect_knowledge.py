import sqlite3
import json

conn = sqlite3.connect('data/webui.db')
cursor = conn.cursor()

# Get all knowledge bases
cursor.execute('SELECT * FROM knowledge')
knowledge = cursor.fetchall()

print("Knowledge bases:")
print(f"Found {len(knowledge)} knowledge bases")

for kb in knowledge:
    print(f"\nKnowledge ID: {kb[0]}")
    print(f"User ID: {kb[1]}")
    print(f"Name: {kb[2]}")
    print(f"Description: {kb[3]}")
    print(f"Created at: {kb[5]}")

# Get all knowledge files
cursor.execute('SELECT * FROM knowledge_file LIMIT 10')
knowledge_files = cursor.fetchall()

print(f"\n\nKnowledge files (first 10):")
print(f"Found {len(knowledge_files)} knowledge files")

for kf in knowledge_files:
    print(f"\nFile ID: {kf[0]}")
    print(f"Knowledge ID: {kf[1]}")
    print(f"Filename: {kf[2]}")

conn.close()
