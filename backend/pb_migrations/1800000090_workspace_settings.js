/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const collection = app.findCollectionByNameOrId("workspaces");
  collection.fields.add(new Field({
    name: "settings",
    type: "json",
  }));
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("workspaces");
  collection.fields.removeByName("settings");
  app.save(collection);
});
