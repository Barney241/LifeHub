# 🗄️ LifeHub Migrations Guide

This document outlines how migrations work in the LifeHub backend, specifically targeting the **PocketBase v0.23+ JavaScript VM (JSVM)** architecture.

## 📂 Location
Migrations are stored in: `backend/pb_migrations/`

## 📄 Filename Structure
Migrations follow the pattern: `TIMESTAMP_name.js`
-   Example: `1800000001_bootstrap.js`
-   PocketBase executes migrations in **lexicographical order** based on their filename.
-   LifeHub uses high-value timestamps (`1800...`) to ensure custom migrations run after PocketBase's internal system migrations.

## 🛠️ The Migration Function
Each file must export (or call) the `migrate` function:

```javascript
migrate((app) => {
  // UP: logic to apply changes
}, (app) => {
  // DOWN: logic to revert changes (optional)
})
```

### The `app` Instance
In v0.23+, the `app` instance provided to migrations is a transactional reference to the PocketBase application core.
-   `app.findCollectionByNameOrId(name)`: Locates a collection.
-   `app.save(collection)`: Persists changes or creates a new collection.
-   `app.delete(collection)`: Removes a collection.

## 🏗️ Collection & Field Schema (v0.23+)

### Creating a Collection
```javascript
const myCollection = new Collection({
  name: 'my_data',
  type: 'base', // 'base', 'auth', or 'view'
  listRule: "@request.auth.id != ''", // API Rules
  viewRule: "@request.auth.id != ''",
  // ...
});
```

### Adding Fields
PocketBase v0.23 uses dedicated constructor classes for fields. In the LifeHub JSVM environment, these are available in the **global scope**:

| Field Type | Constructor | Key Options |
| :--- | :--- | :--- |
| **Text** | `new TextField()` | `required`, `pattern` |
| **Number** | `new NumberField()` | `min`, `max` |
| **Bool** | `new BoolField()` | `default` |
| **JSON** | `new JSONField()` | - |
| **Date** | `new DateField()` | - |
| **Relation** | `new RelationField()` | `collectionId`, `maxSelect` |

**Example of adding fields:**
```javascript
myCollection.fields.add(new TextField({ 
  name: 'title', 
  required: true 
}));

myCollection.fields.add(new RelationField({ 
  name: 'owner', 
  collectionId: 'users', // Can use Name or ID
  maxSelect: 1 
}));
```

## ⚠️ Common Pitfalls & Tips

### 1. The "ID Only" Bug
When creating a collection, if you pass `fields` as a raw array of objects inside the `new Collection({})` constructor, PocketBase might only save the `id` field. 
**Recommended Approach:** Create the collection object first, then use `collection.fields.add()` before calling `app.save()`.

### 2. Relation Errors
If you get `The relation collection doesn't exist`, ensure:
-   The referenced collection is created **before** the one referencing it.
-   You use the **Collection Name** (e.g., `'workspaces'`) instead of a dynamic ID if the IDs are generated at runtime.

### 3. Namespace Issues
In some environments, constructors might be nested under `core` (e.g., `new core.TextField`). If you see `ReferenceError: core is not defined`, use the constructors directly (`new TextField`).

### 4. Re-running Migrations
PocketBase keeps track of applied migrations in the `_migrations` table. If you edit an existing migration file, **it will not re-run**. To force a re-run:
1.  Rename the file with a newer timestamp.
2.  Or, delete the record from the `_migrations` table in the database (not recommended for production).

---

## 🚀 Creating a New Integration Migration
To add a module via migration:
1.  Add the new collection to `1800000001_bootstrap.js` (or a new file).
2.  Update the `sources` collection's `type` field if necessary (though LifeHub uses a `TextField` for `type` to allow dynamic additions).
3.  Restart the backend.
