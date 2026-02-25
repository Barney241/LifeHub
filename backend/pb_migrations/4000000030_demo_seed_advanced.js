/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    let demoUser, ws;
    try {
        demoUser = app.findAuthRecordByEmail("_pb_users_auth_", "test@test.com");
        const wsColl = app.findCollectionByNameOrId("workspaces");
        ws = app.findFirstRecordByFilter("workspaces", `owner = "${demoUser.id}"`);
    } catch (e) {
        console.log("Demo user or workspace not found — skipping advanced seed.");
        return;
    }

    const userId = demoUser.id;
    const wsId = ws.id;

    console.log("Seeding advanced finance demo data for user:", userId);

    // 1. Seed Subscriptions (Merchants first)
    const merColl = app.findCollectionByNameOrId("finance_merchants");
    const recurringColl = app.findCollectionByNameOrId("finance_recurring");
    const accColl = app.findCollectionByNameOrId("finance_accounts");

    const checkingAccount = app.findFirstRecordByFilter("finance_accounts", `workspace = "${wsId}" && name = "KB Běžný účet"`);

    const subData = [
        { name: "Netflix", amount: 329, freq: "monthly", pattern: "NETFLIX" },
        { name: "Spotify", amount: 159, freq: "monthly", pattern: "SPOTIFY" },
        { name: "Rent / Mortgage", amount: 18500, freq: "monthly", pattern: "HYPOTEKA" },
        { name: "Gym Membership", amount: 1200, freq: "monthly", pattern: "FORM FACTORY" },
        { name: "Internet", amount: 550, freq: "monthly", pattern: "VODAFONE" },
    ];

    for (const sub of subData) {
        // Find or create merchant
        let merchant;
        try {
            merchant = app.findFirstRecordByFilter("finance_merchants", `name = "${sub.name}" && workspace = "${wsId}"`);
        } catch (e) {
            merchant = new Record(merColl);
            merchant.set("name", sub.name);
            merchant.set("workspace", wsId);
            merchant.set("is_subscription", true);
            merchant.set("patterns", [sub.pattern]);
            app.save(merchant);
        }

        const rec = new Record(recurringColl);
        rec.set("merchant", merchant.id);
        rec.set("account", checkingAccount.id);
        rec.set("expected_amount", sub.amount);
        rec.set("frequency", sub.freq);
        rec.set("status", "active");
        rec.set("workspace", wsId);
        // Set next due to sometime next month
        const nextDue = new Date();
        nextDue.setMonth(nextDue.getMonth() + 1);
        nextDue.setDate(15);
        rec.set("next_due", nextDue.toISOString());
        app.save(rec);
    }

    // 2. Seed Savings Goals
    const goalColl = app.findCollectionByNameOrId("finance_goals");
    const goals = [
        { name: "Emergency Fund", target: 300000, current: 150000, color: "#10b981", icon: "shield" },
        { name: "Summer Vacation 2026", target: 80000, current: 12000, color: "#f59e0b", icon: "palmtree" },
        { name: "New Laptop", target: 65000, current: 45000, color: "#3b82f6", icon: "laptop" },
    ];

    for (const g of goals) {
        const goal = new Record(goalColl);
        goal.set("name", g.name);
        goal.set("target_amount", g.target);
        goal.set("current_amount", g.current);
        goal.set("color", g.color);
        goal.set("icon", g.icon);
        goal.set("currency", "CZK");
        goal.set("workspace", wsId);
        goal.set("owner", userId);
        app.save(goal);
    }

    // 3. Seed Net Worth History (6 months)
    const nwColl = app.findCollectionByNameOrId("finance_net_worth_history");
    const months = 6;
    const baseAssets = 500000;
    const baseLiabs = 2000000; // Large mortgage

    for (let i = months; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        date.setDate(1);

        const assets = baseAssets + (months - i) * 15000; // Savings growing
        const liabs = baseLiabs - (months - i) * 8000;   // Debt shrinking

        const nw = new Record(nwColl);
        nw.set("date", date.toISOString());
        nw.set("total_assets", assets);
        nw.set("total_liabilities", liabs);
        nw.set("net_worth", assets - liabs);
        nw.set("currency", "CZK");
        nw.set("workspace", wsId);
        nw.set("owner", userId);
        app.save(nw);
    }

    // 4. Seed Exchange Rates
    const rateColl = app.findCollectionByNameOrId("finance_exchange_rates");
    const rates = [
        { base: "EUR", target: "CZK", rate: 25.32 },
        { base: "USD", target: "CZK", rate: 23.45 },
        { base: "EUR", target: "USD", rate: 1.08 },
    ];

    for (const r of rates) {
        const rate = new Record(rateColl);
        rate.set("base_currency", r.base);
        rate.set("target_currency", r.target);
        rate.set("rate", r.rate);
        rate.set("date", new Date().toISOString());
        app.save(rate);
    }

    console.log("✅ Advanced finance demo seed complete!");

}, (app) => {
    // Down migration not needed for demo seed
});
