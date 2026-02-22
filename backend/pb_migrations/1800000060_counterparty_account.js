migrate((app) => {
  // Add counterparty_account to finance_transactions
  const transactions = app.findCollectionByNameOrId('finance_transactions');
  transactions.fields.add(new TextField({
    name: 'counterparty_account',
  }));
  app.save(transactions);

  // Add match_field to finance_import_rules for specifying which field to match
  const rules = app.findCollectionByNameOrId('finance_import_rules');
  rules.fields.add(new TextField({
    name: 'match_field',
  }));
  app.save(rules);
}, (app) => {
  const transactions = app.findCollectionByNameOrId('finance_transactions');
  transactions.fields.removeByName('counterparty_account');
  app.save(transactions);

  const rules = app.findCollectionByNameOrId('finance_import_rules');
  rules.fields.removeByName('match_field');
  app.save(rules);
});
