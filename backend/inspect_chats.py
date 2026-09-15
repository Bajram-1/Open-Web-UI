import sqlite3
import json

conn = sqlite3.connect('data/webui.db')
cursor = conn.cursor()

# Get all chats
cursor.execute('SELECT id, title, chat FROM chat LIMIT 5')
chats = cursor.fetchall()

print("Sample chats:")
for chat in chats:
    print(f"\nChat ID: {chat[0]}")
    print(f"Title: {chat[1]}")
    print(f"Chat data (first 500 chars): {str(chat[2])[:500]}")

conn.close()
