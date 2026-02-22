migrate((app) => {
  const collection = app.findCollectionByNameOrId('finance_transactions');

  // Find and update the source field to not be required
  const sourceField = collection.fields.getByName('source');
  if (sourceField) {
    sourceField.required = false;
  }

  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId('finance_transactions');

  const sourceField = collection.fields.getByName('source');
  if (sourceField) {
    sourceField.required = true;
  }

  app.save(collection);
});
