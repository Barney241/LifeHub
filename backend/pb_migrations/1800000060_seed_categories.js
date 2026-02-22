migrate((app) => {
  // Get all workspaces
  const workspaces = app.findRecordsByFilter('workspaces', '', '', 100, 0);

  const defaultCategories = [
    { name: 'Income', icon: 'trending-up', color: '#10b981', is_system: true },
    { name: 'Food & Dining', icon: 'utensils', color: '#f59e0b', is_system: true },
    { name: 'Shopping', icon: 'shopping-bag', color: '#8b5cf6', is_system: true },
    { name: 'Transportation', icon: 'car', color: '#3b82f6', is_system: true },
    { name: 'Housing', icon: 'home', color: '#6366f1', is_system: true },
    { name: 'Utilities', icon: 'zap', color: '#eab308', is_system: true },
    { name: 'Entertainment', icon: 'film', color: '#ec4899', is_system: true },
    { name: 'Healthcare', icon: 'heart', color: '#ef4444', is_system: true },
    { name: 'Education', icon: 'book', color: '#14b8a6', is_system: true },
    { name: 'Subscriptions', icon: 'repeat', color: '#f97316', is_system: true },
    { name: 'Personal', icon: 'user', color: '#64748b', is_system: true },
    { name: 'Groceries', icon: 'shopping-cart', color: '#22c55e', is_system: true },
    { name: 'Uncategorized', icon: 'help-circle', color: '#94a3b8', is_system: true },
  ];

  const collection = app.findCollectionByNameOrId('finance_categories');

  for (const ws of workspaces) {
    for (const cat of defaultCategories) {
      // Check if category already exists
      const filter = `workspace = '${ws.id}' && name = '${cat.name}'`;
      const existing = app.findRecordsByFilter('finance_categories', filter, '', 1, 0);
      if (existing.length > 0) continue;

      const record = new Record(collection, {
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        is_system: cat.is_system,
        workspace: ws.id,
      });
      app.save(record);
    }
  }
}, (app) => {
  // Down: remove system categories
  const records = app.findRecordsByFilter('finance_categories', 'is_system = true', '', 1000, 0);
  for (const record of records) {
    app.delete(record);
  }
});
