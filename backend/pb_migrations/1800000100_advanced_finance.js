/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    // 1. Finance Goals (Savings Pots)
    const goals = new Collection({
        id: 'pbc_finance_goals',
        name: 'finance_goals',
        type: 'base',
        fields: [
            { name: 'name', type: 'text', required: true },
            { name: 'target_amount', type: 'number', required: true },
            { name: 'current_amount', type: 'number', 'default': 0 },
            { name: 'currency', type: 'text', required: true, 'default': 'CZK' },
            { name: 'target_date', type: 'date' },
            { name: 'color', type: 'text', 'default': '#3b82f6' },
            { name: 'icon', type: 'text' },
            { name: 'linked_account', type: 'relation', collectionId: 'pbc_finance_accounts', maxSelect: 1 },
            { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
            { name: 'owner', type: 'relation', required: true, collectionId: '_pb_users_auth_', maxSelect: 1 },
            { name: 'is_active', type: 'bool', 'default': true },
        ],
        listRule: "@request.auth.id != '' && owner = @request.auth.id",
        viewRule: "@request.auth.id != '' && owner = @request.auth.id",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && owner = @request.auth.id",
        deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(goals);

    // 2. Net Worth History (Snapshots)
    const netWorthHistory = new Collection({
        id: 'pbc_finance_net_worth',
        name: 'finance_net_worth_history',
        type: 'base',
        fields: [
            { name: 'date', type: 'date', required: true },
            { name: 'total_assets', type: 'number', required: true },
            { name: 'total_liabilities', type: 'number', required: true },
            { name: 'net_worth', type: 'number', required: true },
            { name: 'currency', type: 'text', required: true, 'default': 'CZK' },
            { name: 'workspace', type: 'relation', required: true, collectionId: 'pbc_workspaces', maxSelect: 1 },
            { name: 'owner', type: 'relation', required: true, collectionId: '_pb_users_auth_', maxSelect: 1 },
        ],
        listRule: "@request.auth.id != '' && owner = @request.auth.id",
        viewRule: "@request.auth.id != '' && owner = @request.auth.id",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != '' && owner = @request.auth.id",
        deleteRule: "@request.auth.id != '' && owner = @request.auth.id",
    });
    app.save(netWorthHistory);

    // 3. Exchange Rates (Cache)
    const exchangeRates = new Collection({
        id: 'pbc_finance_rates',
        name: 'finance_exchange_rates',
        type: 'base',
        fields: [
            { name: 'base_currency', type: 'text', required: true },
            { name: 'target_currency', type: 'text', required: true },
            { name: 'rate', type: 'number', required: true },
            { name: 'date', type: 'date', required: true },
        ],
        listRule: "@request.auth.id != ''", // Shared cache
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: "@request.auth.id != ''",
        deleteRule: "@request.auth.id != ''",
    });
    app.save(exchangeRates);

}, (app) => {
    const collections = [
        'finance_exchange_rates',
        'finance_net_worth_history',
        'finance_goals'
    ];

    for (const name of collections) {
        try {
            const collection = app.findCollectionByNameOrId(name);
            if (collection) {
                app.delete(collection);
            }
        } catch (e) { }
    }
})
