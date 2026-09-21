# Authentication and role policy

## PostgreSQL credential storage

Open WebUI intentionally separates identity/profile data from credentials:

- `user`: profile, email, role and settings.
- `auth`: authentication data. `auth.id` matches `user.id`.
- `auth.password`: the one-way password hash. Plain-text passwords are never stored.

Do not add a second password hash column to `user`. A duplicate credential field
can become inconsistent and increases the risk of accidental disclosure.

To verify the relationship in PostgreSQL without returning password hashes:

```sql
SELECT u.id, u.name, u.email, u.role, a.active,
       (a.password IS NOT NULL AND a.password <> '') AS has_password
FROM "user" AS u
LEFT JOIN auth AS a ON a.id = u.id
ORDER BY u.created_at;
```

## Roles

- `admin`: user CRUD, Knowledge/document management and normal chat.
- `user`: chat and questions only.

The deployment disables public signup. Administrators create users from
**Admin Panel > Users** and can change a user's role or password there.

## Documents

Administrators can open **Workspace > Knowledge**, create a knowledge base and
upload PDFs. Regular users cannot open the Knowledge workspace or attach files
to chat.

The separately deployed FARSH API still uses its own bundled PDF/FAISS index.
Uploading a file to Open WebUI Knowledge stores and indexes it in Open WebUI;
it does not automatically replace the FARSH API index.
