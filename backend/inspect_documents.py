import sqlite3
import json

conn = sqlite3.connect('data/webui.db')
cursor = conn.cursor()

# Get all documents
cursor.execute('SELECT * FROM document')
documents = cursor.fetchall()

print("Documents:")
print(f"Found {len(documents)} documents")

for doc in documents:
    print(f"\nDocument ID: {doc[0]}")
    print(f"Collection: {doc[1]}")
    print(f"Name: {doc[2]}")
    print(f"Title: {doc[3]}")
    print(f"Filename: {doc[4]}")
    print(f"User ID: {doc[6]}")
    print(f"Timestamp: {doc[7]}")

conn.close()
