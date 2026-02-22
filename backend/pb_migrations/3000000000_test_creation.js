migrate((app) => {
  // Use a unique name to avoid conflicts
  let workspace;
  try {
    workspace = app.findFirstRecordByData("workspaces", "name", "Marketplace Test");
  } catch (e) {
    // If error (not found), workspace remains undefined
  }

  let wsId = "";
  if (!workspace) {
    console.log("Creating Test Workspace...");
    const collection = app.findCollectionByNameOrId("workspaces");
    const ws = new Record(collection);
    ws.set("name", "Marketplace Test");
    ws.set("slug", "m-test");
    app.save(ws);
    wsId = ws.id;
  } else {
    wsId = workspace.id;
  }

  console.log("Testing source creation with type 'internal_tasks'...");
  try {
    const sCollection = app.findCollectionByNameOrId("sources");
    const source = new Record(sCollection);
    source.set("name", "Manual Task Source");
    source.set("type", "internal_tasks");
    source.set("workspace", wsId);
    source.set("active", true);
    app.save(source);
    console.log("SUCCESS: Source created successfully");
  } catch (e) {
    console.log("FAILED: Source creation failed:", e);
    // Log the collection schema again to be sure
    const coll = app.findCollectionByNameOrId("sources");
    console.log("Sources fields at failure:", JSON.stringify(coll.fields));
  }
}, (app) => {})