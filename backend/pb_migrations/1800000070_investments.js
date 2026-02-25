migrate((app) => {
  // ============================================
  // 1. Investment Portfolios
  // ============================================
  const portfolios = new Collection({
    id: 'pbc_investment_portfolios',
    name: 'investment_portfolios',
    type: 'base',
    fields: [
      { name: 'provider', type: 'text', required: true }, // fondee, amundi
      { name: 'name', type: 'text', required: true },
      { name: 'contract_id', type: 'text' },
      { name: 'currency', type: 'text', required: true },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(portfolios);

  // ============================================
  // 2. Investment Snapshots
  // ============================================
  const snapshots = new Collection({
    id: 'pbc_investment_snapshots',
    name: 'investment_snapshots',
    type: 'base',
    fields: [
      { name: 'portfolio', type: 'relation', required: true, collectionId: 'pbc_investment_portfolios', maxSelect: 1 },
      { name: 'report_date', type: 'date', required: true },
      { name: 'period_start', type: 'date' },
      { name: 'period_end', type: 'date' },
      { name: 'start_value', type: 'number' },
      { name: 'end_value', type: 'number' },
      { name: 'invested', type: 'number' },
      { name: 'gain_loss', type: 'number' },
      { name: 'fees', type: 'number' },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(snapshots);

  // ============================================
  // 3. Investment Holdings (per snapshot)
  // ============================================
  const holdings = new Collection({
    id: 'pbc_investment_holdings',
    name: 'investment_holdings',
    type: 'base',
    fields: [
      { name: 'snapshot', type: 'relation', required: true, collectionId: 'pbc_investment_snapshots', maxSelect: 1 },
      { name: 'name', type: 'text', required: true },
      { name: 'isin', type: 'text' },
      { name: 'category', type: 'text' },
      { name: 'units', type: 'number' },
      { name: 'price_per_unit', type: 'number' },
      { name: 'price_currency', type: 'text' },
      { name: 'total_value', type: 'number' },
      { name: 'value_currency', type: 'text' },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(holdings);

}, (app) => {
  const collections = [
    'investment_holdings',
    'investment_snapshots',
    'investment_portfolios',
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
