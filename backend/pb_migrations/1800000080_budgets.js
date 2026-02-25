migrate((app) => {
  // ============================================
  // 1. Finance Income Sources
  // ============================================
  const incomeSources = new Collection({
    id: 'pbc_finance_income_sources',
    name: 'finance_income_sources',
    type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'income_type', type: 'text', required: true }, // "fixed" or "hourly"
      { name: 'amount', type: 'number', required: true },
      { name: 'currency', type: 'text', required: true },
      { name: 'default_hours', type: 'number' }, // for hourly type
      { name: 'is_active', type: 'bool' },
      { name: 'notes', type: 'text' },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(incomeSources);

  // ============================================
  // 2. Finance Income Hours (monthly overrides)
  // ============================================
  const incomeHours = new Collection({
    id: 'pbc_finance_income_hours',
    name: 'finance_income_hours',
    type: 'base',
    fields: [
      { name: 'income_source', type: 'relation', required: true, collectionId: 'pbc_finance_income_sources', maxSelect: 1 },
      { name: 'year', type: 'number', required: true },
      { name: 'month', type: 'number', required: true },
      { name: 'hours', type: 'number', required: true },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(incomeHours);

  // ============================================
  // 3. Finance Budgets (groups)
  // ============================================
  const budgets = new Collection({
    id: 'pbc_finance_budgets',
    name: 'finance_budgets',
    type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'icon', type: 'text' },
      { name: 'color', type: 'text' },
      { name: 'sort_order', type: 'number' },
      { name: 'is_active', type: 'bool' },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(budgets);

  // ============================================
  // 4. Finance Budget Items (line items)
  // ============================================
  const budgetItems = new Collection({
    id: 'pbc_finance_budget_items',
    name: 'finance_budget_items',
    type: 'base',
    fields: [
      { name: 'budget', type: 'relation', required: true, collectionId: 'pbc_finance_budgets', maxSelect: 1 },
      { name: 'name', type: 'text', required: true },
      { name: 'budgeted_amount', type: 'number', required: true },
      { name: 'currency', type: 'text', required: true },
      { name: 'frequency', type: 'text', required: true }, // "monthly" or "yearly"
      // Match fields (reuse pattern from finance_import_rules)
      { name: 'match_pattern', type: 'text' },
      { name: 'match_pattern_type', type: 'text' }, // contains, regex, exact
      { name: 'match_field', type: 'text' }, // description, raw_description, counterparty_account
      { name: 'match_category', type: 'relation', collectionId: 'pbc_finance_categories', maxSelect: 1 },
      { name: 'match_merchant', type: 'relation', collectionId: 'pbc_finance_merchants', maxSelect: 1 },
      { name: 'match_account', type: 'relation', collectionId: 'pbc_finance_accounts', maxSelect: 1 },
      { name: 'is_expense', type: 'bool' },
      { name: 'sort_order', type: 'number' },
      { name: 'is_active', type: 'bool' },
      { name: 'notes', type: 'text' },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(budgetItems);

}, (app) => {
  const collections = [
    'finance_budget_items',
    'finance_budgets',
    'finance_income_hours',
    'finance_income_sources',
  ];

  for (const name of collections) {
    try {
      const collection = app.findCollectionByNameOrId(name);
      if (collection) {
        app.delete(collection);
      }
    } catch (e) {}
  }
});
