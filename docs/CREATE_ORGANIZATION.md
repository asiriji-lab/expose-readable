# Creating a New Organization

## 1. Generate a registration key

Keys follow Google Classroom format — 7 uppercase alphanumeric characters (e.g. `ABC1234`).

```bash
python3 -c "import random, string; print(''.join(random.choices(string.ascii_uppercase + string.digits, k=7)))"
```

Example output: `XK9F2MT`

Share this key with admins who need to register under this organization. They enter it in the **Organization Key** field during the complete-profile step.

## 2. Insert the organization into the database

### Via psql

```sql
INSERT INTO organizations (name, registration_key)
VALUES ('Your School Name', 'XK9F2MT');
```

### Via Python (Flask shell)

```bash
flask shell
```

```python
from src.db import models
models.create_organization(name='Your School Name', registration_key='XK9F2MT')
```

## 3. Verify

```sql
SELECT org_id, name, registration_key, created_at FROM organizations ORDER BY created_at DESC LIMIT 5;
```

## Notes

- Keys are stored and compared **uppercase** — input is normalized automatically.
- Each organization must have a **unique** key.
- Do not share keys publicly. Rotate by updating the `registration_key` column directly in the DB.
