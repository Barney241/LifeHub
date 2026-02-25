/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    const loans = new Collection({
        id: 'pbc_finance_loans',
        name: 'finance_loans',
        type: 'base',
        listRule: "workspace.owner = @request.auth.id",
        viewRule: "workspace.owner = @request.auth.id",
        createRule: "workspace.owner = @request.auth.id",
        updateRule: "workspace.owner = @request.auth.id",
        deleteRule: "workspace.owner = @request.auth.id",
    });

    // Core identity
    loans.fields.add(new TextField({ name: 'name', required: true }));
    loans.fields.add(new SelectField({
        name: 'loan_type',
        required: true,
        values: ['mortgage', 'personal', 'car', 'student', 'borrowed_from', 'lent_to'],
    }));
    loans.fields.add(new TextField({ name: 'counterparty' })); // bank name or person

    // Financial terms
    loans.fields.add(new NumberField({ name: 'principal', required: true }));
    loans.fields.add(new NumberField({ name: 'current_balance', required: true }));
    loans.fields.add(new NumberField({ name: 'interest_rate' }));   // annual %
    loans.fields.add(new NumberField({ name: 'monthly_payment' })); // expected instalment
    loans.fields.add(new TextField({ name: 'currency', required: true }));

    // Timeline
    loans.fields.add(new DateField({ name: 'start_date' }));
    loans.fields.add(new DateField({ name: 'end_date' }));   // scheduled payoff

    // Transaction matching (same pattern as budget items)
    loans.fields.add(new TextField({ name: 'match_pattern' }));
    loans.fields.add(new SelectField({
        name: 'match_pattern_type',
        values: ['contains', 'exact', 'starts_with', 'regex'],
    }));
    loans.fields.add(new SelectField({
        name: 'match_field',
        values: ['description', 'merchant'],
    }));

    loans.fields.add(new TextField({ name: 'notes' }));
    loans.fields.add(new BoolField({ name: 'is_active', required: true }));
    loans.fields.add(new RelationField({
        name: 'workspace',
        collectionId: 'pbc_workspaces',
        maxSelect: 1,
        required: true,
    }));

    app.save(loans);
    console.log("✅ finance_loans collection created");

}, (app) => {
    try {
        const col = app.findCollectionByNameOrId('finance_loans');
        if (col) app.delete(col);
    } catch (e) { }
});
