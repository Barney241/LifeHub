migrate((app) => {
  const collectionNames = ['devices', 'finance_transactions', 'tasks', 'sources', 'workspaces'];
  
  for (const name of collectionNames) {
    try {
      const collection = app.findCollectionByNameOrId(name);
      if (collection) {
        app.delete(collection);
      }
    } catch (e) {}
  }

  // 1. Workspaces
  const workspaces = new Collection({
    id: 'pbc_workspaces',
    name: 'workspaces',
    type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'slug', type: 'text', required: true },
      { name: 'description', type: 'text' },
      { name: 'icon', type: 'text' },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(workspaces);

  // 2. Sources
  const sources = new Collection({
    id: 'pbc_sources',
    name: 'sources',
    type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'type', type: 'text', required: true },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
      { name: 'config', type: 'json' },
      { name: 'active', type: 'bool', 'default': true },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(sources);

  // 3. Tasks
  const tasks = new Collection({
    id: 'pbc_tasks',
    name: 'tasks',
    type: 'base',
    fields: [
      { name: 'content', type: 'text', required: true },
      { name: 'priority', type: 'text', 'default': 'medium' },
      { name: 'completed', type: 'bool', 'default': false },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
      { name: 'source', type: 'relation', required: true, collectionId: 'pbc_sources', maxSelect: 1 },
      { name: 'due_date', type: 'date' },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(tasks);

  // 4. Finance
  const finance = new Collection({
    id: 'pbc_finance',
    name: 'finance_transactions',
    type: 'base',
    fields: [
      { name: 'description', type: 'text', required: true },
      { name: 'amount', type: 'number', required: true },
      { name: 'type', type: 'text', required: true },
      { name: 'category', type: 'text' },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
      { name: 'source', type: 'relation', required: true, collectionId: 'pbc_sources', maxSelect: 1 },
      { name: 'date', type: 'date', required: true },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(finance);

  // 5. Devices
  const devices = new Collection({
    id: 'pbc_devices',
    name: 'devices',
    type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'token', type: 'text', required: true },
      { name: 'user', type: 'relation', required: true, collectionId: '_pb_users_auth_', maxSelect: 1 },
      { name: 'allowed_workspaces', type: 'relation', collectionId: 'pbc_workspaces', maxSelect: 50 },
      { name: 'permissions', type: 'json' },
      { name: 'refresh_rate', type: 'number', 'default': 1800 },
      { name: 'last_active', type: 'date' },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(devices);

}, (app) => {})
