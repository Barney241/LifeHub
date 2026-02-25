/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    // ── Guard: find demo workspace ────────────────────────────────────────────
    const workspaces = app.findRecordsByFilter('workspaces', `name = 'Demo Workspace'`, '', 1, 0);
    if (!workspaces || workspaces.length === 0) {
        console.log("Demo workspace not found — skipping loan seed.");
        return;
    }
    const wsId = workspaces[0].id;

    // Idempotent guard
    const existing = app.findRecordsByFilter('finance_loans', `workspace = '${wsId}'`, '', 1, 0);
    if (existing && existing.length > 0) {
        console.log("Loan data already seeded — skipping.");
        return;
    }

    const loanColl = app.findCollectionByNameOrId('finance_loans');

    // ── Loan 1: KB Hypotéka (mortgage, 30-year, 4.89%) ───────────────────────
    // Started Feb 2021, principal 3 800 000 Kč, ~27 months paid
    // Monthly payment ~20 100 Kč (principal=18500, interest=1600 approx)
    const mortgage = new Record(loanColl);
    mortgage.set("name", "KB Hypotéka");
    mortgage.set("loan_type", "mortgage");
    mortgage.set("counterparty", "Komerční Banka");
    mortgage.set("principal", 3800000);
    mortgage.set("current_balance", 3337500);  // ~27 payments in
    mortgage.set("interest_rate", 4.89);
    mortgage.set("monthly_payment", 20100);
    mortgage.set("currency", "CZK");
    mortgage.set("start_date", "2021-02-01 00:00:00.000Z");
    mortgage.set("end_date", "2051-02-01 00:00:00.000Z");  // 30 years
    mortgage.set("match_pattern", "HYPOTEKA");
    mortgage.set("match_pattern_type", "contains");
    mortgage.set("match_field", "description");
    mortgage.set("notes", "Fixed rate until 2026-02. Rate refixation expected.");
    mortgage.set("is_active", true);
    mortgage.set("workspace", wsId);
    app.save(mortgage);

    // ── Loan 2: Personal loan from a friend (borrowed_from) ──────────────────
    const personal = new Record(loanColl);
    personal.set("name", "Půjčka od Martina");
    personal.set("loan_type", "borrowed_from");
    personal.set("counterparty", "Martin Novák");
    personal.set("principal", 50000);
    personal.set("current_balance", 20000);  // Paid back 30 000
    personal.set("interest_rate", 0);        // Interest-free
    personal.set("monthly_payment", 5000);
    personal.set("currency", "CZK");
    personal.set("start_date", "2025-08-01 00:00:00.000Z");
    personal.set("end_date", "2026-06-01 00:00:00.000Z");
    personal.set("match_pattern", "MARTIN NOVAK");
    personal.set("match_pattern_type", "contains");
    personal.set("match_field", "description");
    personal.set("notes", "Interest-free loan to cover car repair. Monthly repayments of 5 000 Kč.");
    personal.set("is_active", true);
    personal.set("workspace", wsId);
    app.save(personal);

    // ── Loan 3: Money lent to a colleague (lent_to) ───────────────────────────
    const lent = new Record(loanColl);
    lent.set("name", "Půjčka Tomášovi");
    lent.set("loan_type", "lent_to");
    lent.set("counterparty", "Tomáš Dvořák");
    lent.set("principal", 15000);
    lent.set("current_balance", 10000);  // 5 000 received back
    lent.set("interest_rate", 0);
    lent.set("monthly_payment", 2500);
    lent.set("currency", "CZK");
    lent.set("start_date", "2025-11-01 00:00:00.000Z");
    lent.set("end_date", "2026-05-01 00:00:00.000Z");
    lent.set("match_pattern", "TOMAS DVORAK");
    lent.set("match_pattern_type", "contains");
    lent.set("match_field", "description");
    lent.set("notes", "Lent money for laptop purchase. Repayments 2 500/month.");
    lent.set("is_active", true);
    lent.set("workspace", wsId);
    app.save(lent);

    console.log("✅ Loan seed complete! 3 loans created (mortgage + personal + lent)");
}, (app) => {
    // Down: no-op, loans cascade deleted with workspace
});
