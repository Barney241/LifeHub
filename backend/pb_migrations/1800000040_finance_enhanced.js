migrate((app) => {
  // ============================================
  // 1. Finance Accounts (must be created first for relations)
  // ============================================
  const accounts = new Collection({
    id: 'pbc_finance_accounts',
    name: 'finance_accounts',
    type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'bank_name', type: 'text' },
      { name: 'account_number', type: 'text' },
      { name: 'currency', type: 'text', required: true },
      { name: 'account_type', type: 'text', required: true }, // checking, savings, credit, cash
      { name: 'icon', type: 'text' },
      { name: 'color', type: 'text' },
      { name: 'initial_balance', type: 'number', 'default': 0 },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
      { name: 'is_active', type: 'bool', 'default': true },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(accounts);

  // ============================================
  // 2. Finance Categories (create without self-ref first)
  // ============================================
  const categories = new Collection({
    id: 'pbc_finance_categories',
    name: 'finance_categories',
    type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'icon', type: 'text' },
      { name: 'color', type: 'text' },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
      { name: 'is_system', type: 'bool', 'default': false },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(categories);

  // Add self-referential parent field after collection exists
  const categoriesRef = app.findCollectionByNameOrId('finance_categories');
  categoriesRef.fields.add(new RelationField({
    name: 'parent',
    collectionId: 'pbc_finance_categories',
    maxSelect: 1,
  }));
  app.save(categoriesRef);

  // ============================================
  // 3. Finance Merchants
  // ============================================
  const merchants = new Collection({
    id: 'pbc_finance_merchants',
    name: 'finance_merchants',
    type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'display_name', type: 'text' },
      { name: 'patterns', type: 'json' }, // Array of pattern strings
      { name: 'category', type: 'relation', collectionId: 'pbc_finance_categories', maxSelect: 1 },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
      { name: 'is_subscription', type: 'bool', 'default': false },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(merchants);

  // ============================================
  // 4. Finance Recurring Payments
  // ============================================
  const recurring = new Collection({
    id: 'pbc_finance_recurring',
    name: 'finance_recurring',
    type: 'base',
    fields: [
      { name: 'merchant', type: 'relation', required: true, collectionId: 'pbc_finance_merchants', maxSelect: 1 },
      { name: 'account', type: 'relation', collectionId: 'pbc_finance_accounts', maxSelect: 1 },
      { name: 'expected_amount', type: 'number', required: true },
      { name: 'frequency', type: 'text', required: true }, // weekly, monthly, yearly, custom
      { name: 'frequency_days', type: 'number' }, // For custom frequency
      { name: 'next_due', type: 'date' },
      { name: 'last_paid', type: 'date' },
      { name: 'status', type: 'text', 'default': 'active' }, // active, paused, cancelled
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
      { name: 'notes', type: 'text' },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(recurring);

  // ============================================
  // 5. Finance Import Rules
  // ============================================
  const importRules = new Collection({
    id: 'pbc_finance_import_rules',
    name: 'finance_import_rules',
    type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'pattern', type: 'text', required: true },
      { name: 'pattern_type', type: 'text', 'default': 'contains' }, // contains, regex, exact
      { name: 'category', type: 'relation', collectionId: 'pbc_finance_categories', maxSelect: 1 },
      { name: 'merchant', type: 'relation', collectionId: 'pbc_finance_merchants', maxSelect: 1 },
      { name: 'priority', type: 'number', 'default': 0 },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
      { name: 'active', type: 'bool', 'default': true },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(importRules);

  // ============================================
  // 6. Finance Imports (history)
  // ============================================
  const imports = new Collection({
    id: 'pbc_finance_imports',
    name: 'finance_imports',
    type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'bank_name', type: 'text' },
      { name: 'account', type: 'relation', collectionId: 'pbc_finance_accounts', maxSelect: 1 },
      { name: 'file_hash', type: 'text' },
      { name: 'field_mapping', type: 'json' },
      { name: 'date_format', type: 'text' },
      { name: 'transactions_imported', type: 'number', 'default': 0 },
      { name: 'transactions_skipped', type: 'number', 'default': 0 },
      { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
      { name: 'source', type: 'relation', collectionId: 'pbc_sources', maxSelect: 1 },
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(imports);

  // ============================================
  // 7. Finance Bank Templates
  // ============================================
  const bankTemplates = new Collection({
    id: 'pbc_finance_bank_templates',
    name: 'finance_bank_templates',
    type: 'base',
    fields: [
      { name: 'name', type: 'text', required: true },
      { name: 'code', type: 'text', required: true }, // csob, fio, generic
      { name: 'delimiter', type: 'text', 'default': ',' },
      { name: 'encoding', type: 'text', 'default': 'utf-8' },
      { name: 'skip_rows', type: 'number', 'default': 1 },
      { name: 'date_format', type: 'text', required: true },
      { name: 'field_mapping', type: 'json', required: true },
      { name: 'category_mapping', type: 'json' },
      { name: 'merchant_extraction', type: 'json' },
      { name: 'is_system', type: 'bool', 'default': false },
    ],
    listRule: "",  // Public read for templates
    viewRule: "",
    createRule: "@request.auth.id != ''",
    updateRule: "@request.auth.id != ''",
    deleteRule: "@request.auth.id != ''",
  });
  app.save(bankTemplates);

  // ============================================
  // 8. Update finance_transactions with new fields
  // ============================================
  const finance = app.findCollectionByNameOrId('finance_transactions');

  // Add account relation (required for new transactions)
  finance.fields.add(new RelationField({
    name: 'account',
    collectionId: 'pbc_finance_accounts',
    maxSelect: 1,
  }));

  // Add merchant relation
  finance.fields.add(new RelationField({
    name: 'merchant',
    collectionId: 'pbc_finance_merchants',
    maxSelect: 1,
  }));

  // Add category relation (replaces text category field for new imports)
  finance.fields.add(new RelationField({
    name: 'category_rel',
    collectionId: 'pbc_finance_categories',
    maxSelect: 1,
  }));

  // Add raw_description for original bank text
  finance.fields.add(new TextField({
    name: 'raw_description',
  }));

  // Add external_id for deduplication
  finance.fields.add(new TextField({
    name: 'external_id',
  }));

  // Add tags as JSON array
  finance.fields.add(new JSONField({
    name: 'tags',
  }));

  // Add import reference
  finance.fields.add(new RelationField({
    name: 'import_ref',
    collectionId: 'pbc_finance_imports',
    maxSelect: 1,
  }));

  // Add balance_after for running balance
  finance.fields.add(new NumberField({
    name: 'balance_after',
  }));

  app.save(finance);

  // ============================================
  // 9. Seed CSOB bank template
  // ============================================
  const csobTemplate = new Record(bankTemplates, {
    name: 'CSOB',
    code: 'csob',
    delimiter: ';',
    encoding: 'utf-8',
    skip_rows: 2,
    date_format: 'DD.MM.YYYY',
    field_mapping: JSON.stringify({
      account_number: 0,
      date: 1,
      amount: 2,
      currency: 3,
      balance_after: 4,
      counterparty_name: 7,
      operation_type: 12,
      message: 15,
      category: 16,
      external_id: 23
    }),
    category_mapping: JSON.stringify({
      'Příjem': 'Income',
      'Restaurace': 'Food & Dining',
      'Nákupy a služby': 'Shopping',
      'Doprava': 'Transportation',
      'Vzdělání': 'Education',
      'Bydlení': 'Housing',
      'Zábava': 'Entertainment',
      'Zdraví': 'Healthcare'
    }),
    merchant_extraction: JSON.stringify({
      card_transaction_field: 'message',
      card_transaction_pattern: 'Místo:\\s*([^,]+)',
      transfer_field: 'counterparty_name'
    }),
    is_system: true
  });
  app.save(csobTemplate);

}, (app) => {
  // Down migration - remove new collections
  const collections = [
    'finance_bank_templates',
    'finance_imports',
    'finance_import_rules',
    'finance_recurring',
    'finance_merchants',
    'finance_categories',
    'finance_accounts'
  ];

  for (const name of collections) {
    try {
      const collection = app.findCollectionByNameOrId(name);
      if (collection) {
        app.delete(collection);
      }
    } catch (e) {}
  }

  // Remove added fields from finance_transactions
  try {
    const finance = app.findCollectionByNameOrId('finance_transactions');
    const fieldsToRemove = ['account', 'merchant', 'category_rel', 'raw_description', 'external_id', 'tags', 'import_ref', 'balance_after'];
    for (const fieldName of fieldsToRemove) {
      const field = finance.fields.getByName(fieldName);
      if (field) {
        finance.fields.remove(field);
      }
    }
    app.save(finance);
  } catch (e) {}
})
