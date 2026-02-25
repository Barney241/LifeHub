/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const workspacesColl = app.findCollectionByNameOrId('workspaces');

    // ── 1. Add owner field (required) ─────────────────────────────────────────
    const existingOwner = workspacesColl.fields.getByName('owner');
    if (!existingOwner) {
        workspacesColl.fields.add(new RelationField({
            name: 'owner',
            collectionId: '_pb_users_auth_',
            maxSelect: 1,
            required: true,
        }));
        app.save(workspacesColl);
        console.log("Added required 'owner' field to workspaces");
    }

    // ── 2. Backfill: assign demo workspace to demo user ───────────────────────
    try {
        const demoUser = app.findAuthRecordByEmail('_pb_users_auth_', 'test@test.com');
        if (demoUser) {
            const demoWorkspaces = app.findRecordsByFilter(
                'workspaces',
                `name = 'Demo Workspace' && owner = ''`,
                '', 100, 0
            );
            for (const ws of demoWorkspaces) {
                ws.set('owner', demoUser.id);
                app.save(ws);
                console.log('Backfilled owner for Demo Workspace:', ws.id);
            }
        }
    } catch (e) {
        console.log('No demo user found for backfill (ok for non-demo installs)');
    }

    // ── 3. Warn about any remaining ownerless workspaces ─────────────────────
    const orphans = app.findRecordsByFilter('workspaces', "owner = ''", '', 1000, 0);
    if (orphans.length > 0) {
        console.log(
            `⚠️  ${orphans.length} workspace(s) have no owner and will be hidden from all users.`,
            'Use the PocketBase admin UI at http://127.0.0.1:8090/_/ to assign owners.'
        );
    }

    // ── 4. Apply owner-scoped access rules ───────────────────────────────────
    workspacesColl.listRule = "owner = @request.auth.id";
    workspacesColl.viewRule = "owner = @request.auth.id";
    workspacesColl.createRule = "@request.auth.id != ''";
    workspacesColl.updateRule = "owner = @request.auth.id";
    workspacesColl.deleteRule = "owner = @request.auth.id";
    app.save(workspacesColl);
    console.log("✅ Workspace isolation enabled — users can only see their own workspaces");

}, (app) => {
    const workspacesColl = app.findCollectionByNameOrId('workspaces');
    // Revert rules
    workspacesColl.listRule = "@request.auth.id != ''";
    workspacesColl.viewRule = "@request.auth.id != ''";
    workspacesColl.createRule = "@request.auth.id != ''";
    workspacesColl.updateRule = "@request.auth.id != ''";
    workspacesColl.deleteRule = "@request.auth.id != ''";
    // Remove owner field
    const ownerField = workspacesColl.fields.getByName('owner');
    if (ownerField) workspacesColl.fields.remove(ownerField);
    app.save(workspacesColl);
});
