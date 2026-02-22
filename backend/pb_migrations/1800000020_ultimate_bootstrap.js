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

  // Workspaces
  const workspaces = new Collection({
    id: 'pbc_workspaces',
    name: 'workspaces',
    type: 'base',
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  workspaces.fields.add(new TextField({ name: 'name', required: true }));
  workspaces.fields.add(new TextField({ name: 'slug', required: true }));
  workspaces.fields.add(new TextField({ name: 'description' }));
  workspaces.fields.add(new TextField({ name: 'icon' }));
  app.save(workspaces);

  // Sources (Ensuring TextField constructor is used for 'type')
  const sources = new Collection({
    id: 'pbc_sources',
    name: 'sources',
    type: 'base',
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  sources.fields.add(new TextField({ name: 'name', required: true }));
  sources.fields.add(new TextField({ name: 'type', required: true }));
  sources.fields.add(new RelationField({ name: 'workspace', collectionId: 'pbc_workspaces', required: true, maxSelect: 1 }));
  sources.fields.add(new JSONField({ name: 'config' }));
  sources.fields.add(new BoolField({ name: 'active', 'default': true }));
  app.save(sources);

  // Tasks
  const tasks = new Collection({
    id: 'pbc_tasks',
    name: 'tasks',
    type: 'base',
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  tasks.fields.add(new TextField({ name: 'content', required: true }));
  tasks.fields.add(new TextField({ name: 'priority', 'default': 'medium' }));
  tasks.fields.add(new BoolField({ name: 'completed', 'default': false }));
  tasks.fields.add(new RelationField({ name: 'workspace', collectionId: 'pbc_workspaces', required: true, maxSelect: 1 }));
  tasks.fields.add(new DateField({ name: 'due_date' }));
  app.save(tasks);

  // Finance
  const finance = new Collection({
    id: 'pbc_finance',
    name: 'finance_transactions',
    type: 'base',
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  finance.fields.add(new TextField({ name: 'description', required: true }));
  finance.fields.add(new NumberField({ name: 'amount', required: true }));
  finance.fields.add(new TextField({ name: 'type', required: true }));
  finance.fields.add(new TextField({ name: 'category' }));
  finance.fields.add(new RelationField({ name: 'workspace', collectionId: 'pbc_workspaces', required: true, maxSelect: 1 }));
  finance.fields.add(new DateField({ name: 'date', required: true }));
  app.save(finance);

  // Devices
  const devices = new Collection({
    id: 'pbc_devices',
    name: 'devices',
    type: 'base',
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  devices.fields.add(new TextField({ name: 'name', required: true }));
  devices.fields.add(new TextField({ name: 'token', required: true }));
  devices.fields.add(new RelationField({ name: 'user', collectionId: '_pb_users_auth_', required: true, maxSelect: 1 }));
  devices.fields.add(new RelationField({ name: 'allowed_workspaces', collectionId: 'pbc_workspaces', maxSelect: 50 }));
  devices.fields.add(new JSONField({ name: 'permissions' }));
  devices.fields.add(new NumberField({ name: 'refresh_rate', 'default': 1800 }));
  devices.fields.add(new DateField({ name: 'last_active' }));
  app.save(devices);

}, (app) => {})
