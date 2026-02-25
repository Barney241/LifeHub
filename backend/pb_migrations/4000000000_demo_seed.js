/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    // ── Idempotent guard ──────────────────────────────────────────────────────
    let demoUser;
    try {
        demoUser = app.findAuthRecordByEmail("_pb_users_auth_", "test@test.com");
    } catch (e) { /* not found */ }

    if (demoUser) {
        console.log("Demo user already exists — skipping seed.");
        return;
    }

    console.log("Seeding demo data...");

    // ── 1. Demo user ──────────────────────────────────────────────────────────
    const usersCollection = app.findCollectionByNameOrId("_pb_users_auth_");
    const user = new Record(usersCollection);
    user.set("email", "test@test.com");
    user.set("name", "Demo User");
    user.set("emailVisibility", true);
    user.setPassword("testtest");
    user.set("verified", true);
    app.save(user);
    const userId = user.id;
    console.log("Created demo user:", userId);

    // ── 2. Workspace ──────────────────────────────────────────────────────────
    const wsColl = app.findCollectionByNameOrId("workspaces");
    const ws = new Record(wsColl);
    ws.set("name", "Demo Workspace");
    ws.set("slug", "demo");
    ws.set("icon", "🏠");
    ws.set("settings", { display_currency: "CZK" });
    ws.set("owner", userId);
    app.save(ws);
    const wsId = ws.id;


    // ── 3. Accounts ───────────────────────────────────────────────────────────
    const accColl = app.findCollectionByNameOrId("finance_accounts");

    const checking = new Record(accColl);
    checking.set("name", "KB Běžný účet");
    checking.set("bank_name", "Komerční Banka");
    checking.set("currency", "CZK");
    checking.set("account_type", "checking");
    checking.set("initial_balance", 50000);
    checking.set("current_balance", 50000);
    checking.set("is_active", true);
    checking.set("workspace", wsId);
    app.save(checking);
    const checkingId = checking.id;

    const savings = new Record(accColl);
    savings.set("name", "Spoření");
    savings.set("bank_name", "Komerční Banka");
    savings.set("currency", "CZK");
    savings.set("account_type", "savings");
    savings.set("initial_balance", 120000);
    savings.set("current_balance", 120000);
    savings.set("is_active", true);
    savings.set("workspace", wsId);
    app.save(savings);

    // ── 4. Categories ─────────────────────────────────────────────────────────
    const catColl = app.findCollectionByNameOrId("finance_categories");
    const catMap = {};

    const cats = [
        { name: "Income", icon: "trending-up", color: "#10b981", is_system: true },
        { name: "Housing", icon: "home", color: "#6366f1", is_system: true },
        { name: "Food & Dining", icon: "utensils", color: "#f59e0b", is_system: true },
        { name: "Groceries", icon: "shopping-cart", color: "#22c55e", is_system: true },
        { name: "Transportation", icon: "car", color: "#3b82f6", is_system: true },
        { name: "Subscriptions", icon: "repeat", color: "#f97316", is_system: true },
        { name: "Entertainment", icon: "film", color: "#ec4899", is_system: true },
        { name: "Healthcare", icon: "heart", color: "#ef4444", is_system: true },
        { name: "Shopping", icon: "shopping-bag", color: "#8b5cf6", is_system: true },
        { name: "Uncategorized", icon: "help-circle", color: "#94a3b8", is_system: true },
    ];

    for (const c of cats) {
        const r = new Record(catColl);
        r.set("name", c.name);
        r.set("icon", c.icon);
        r.set("color", c.color);
        r.set("is_system", c.is_system);
        r.set("workspace", wsId);
        app.save(r);
        catMap[c.name] = r.id;
    }

    // ── 5. Merchants ──────────────────────────────────────────────────────────
    const merColl = app.findCollectionByNameOrId("finance_merchants");
    const merMap = {};

    const merchants = [
        { name: "ALBERT", display: "Albert", patterns: ["ALBERT"], cat: "Groceries" },
        { name: "LIDL", display: "Lidl", patterns: ["LIDL"], cat: "Groceries" },
        { name: "SPOTIFY", display: "Spotify", patterns: ["SPOTIFY"], cat: "Subscriptions" },
        { name: "NETFLIX", display: "Netflix", patterns: ["NETFLIX"], cat: "Subscriptions" },
        { name: "ROHLIK", display: "Rohlik.cz", patterns: ["ROHLIK"], cat: "Groceries" },
        { name: "BOLT", display: "Bolt", patterns: ["BOLT"], cat: "Transportation" },
        { name: "DPP", display: "Praha MHD", patterns: ["DPP", "DOPRAVNI PODNIK"], cat: "Transportation" },
        { name: "MC_DONALDS", display: "McDonald's", patterns: ["MC DONALDS", "MCDONALD"], cat: "Food & Dining" },
        { name: "HYPOTEKA", display: "Hypoteční splátka", patterns: ["HYPOTEKA", "KB HYPOTEKA"], cat: "Housing" },
        { name: "EON_ELECTRIC", display: "E.ON Elektrina", patterns: ["E.ON", "EON ENERGIE"], cat: "Housing" },
    ];

    for (const m of merchants) {
        const r = new Record(merColl);
        r.set("name", m.name);
        r.set("display_name", m.display);
        r.set("patterns", m.patterns);
        r.set("category_id", catMap[m.cat] || "");
        r.set("is_subscription", m.cat === "Subscriptions");
        r.set("workspace", wsId);
        app.save(r);
        merMap[m.name] = r.id;
    }

    // ── 6. Import Rules ───────────────────────────────────────────────────────
    const ruleColl = app.findCollectionByNameOrId("finance_import_rules");
    const ruleMap = {};

    const rules = [
        { name: "Hypotéka", pattern: "HYPOTEKA", pattern_type: "contains", match_field: "description", category: "Housing", priority: 100 },
        { name: "Albert", pattern: "ALBERT", pattern_type: "contains", match_field: "description", category: "Groceries", priority: 90 },
        { name: "Lidl", pattern: "LIDL", pattern_type: "contains", match_field: "description", category: "Groceries", priority: 90 },
        { name: "Rohlik", pattern: "ROHLIK", pattern_type: "contains", match_field: "description", category: "Groceries", priority: 90 },
        { name: "Spotify", pattern: "SPOTIFY", pattern_type: "contains", match_field: "description", category: "Subscriptions", priority: 85 },
        { name: "Netflix", pattern: "NETFLIX", pattern_type: "contains", match_field: "description", category: "Subscriptions", priority: 85 },
        { name: "Bolt", pattern: "BOLT", pattern_type: "contains", match_field: "description", category: "Transportation", priority: 80 },
        { name: "MHD Praha", pattern: "DPP", pattern_type: "contains", match_field: "description", category: "Transportation", priority: 80 },
        { name: "E.ON Elektřina", pattern: "E.ON", pattern_type: "contains", match_field: "description", category: "Housing", priority: 75 },
        { name: "McDonald's", pattern: "MC DONALDS", pattern_type: "contains", match_field: "description", category: "Food & Dining", priority: 70 },
    ];

    for (const rule of rules) {
        const r = new Record(ruleColl);
        r.set("name", rule.name);
        r.set("pattern", rule.pattern);
        r.set("pattern_type", rule.pattern_type);
        r.set("match_field", rule.match_field);
        r.set("category", catMap[rule.category] || "");
        r.set("priority", rule.priority);
        r.set("active", true);
        r.set("workspace", wsId);
        app.save(r);
        ruleMap[rule.name] = r.id;
    }

    // ── 7. Transactions (Feb 2026 = current month) ───────────────────────────
    const txColl = app.findCollectionByNameOrId("finance_transactions");

    const txns = [
        // Income
        { date: "2026-02-01", desc: "Výplata únor 2026", amount: 68000, type: "income", cat: "Income", merchant: null },
        { date: "2026-02-01", desc: "Freelance platba", amount: 12000, type: "income", cat: "Income", merchant: null },
        // Housing
        { date: "2026-02-05", desc: "HYPOTEKA KB 5/2026", amount: 18500, type: "expense", cat: "Housing", merchant: "HYPOTEKA" },
        { date: "2026-02-10", desc: "E.ON Elektrina 02/2026", amount: 2200, type: "expense", cat: "Housing", merchant: "EON_ELECTRIC" },
        // Groceries
        { date: "2026-02-02", desc: "ALBERT NAKUP Praha", amount: 1240, type: "expense", cat: "Groceries", merchant: "ALBERT" },
        { date: "2026-02-07", desc: "LIDL CS nakup 1234", amount: 890, type: "expense", cat: "Groceries", merchant: "LIDL" },
        { date: "2026-02-09", desc: "ROHLIK.CZ objednavka", amount: 1560, type: "expense", cat: "Groceries", merchant: "ROHLIK" },
        { date: "2026-02-14", desc: "ALBERT NAKUP Praha", amount: 980, type: "expense", cat: "Groceries", merchant: "ALBERT" },
        { date: "2026-02-17", desc: "LIDL CS nakup 5678", amount: 1120, type: "expense", cat: "Groceries", merchant: "LIDL" },
        { date: "2026-02-21", desc: "ALBERT NAKUP Praha", amount: 1380, type: "expense", cat: "Groceries", merchant: "ALBERT" },
        // Subscriptions
        { date: "2026-02-06", desc: "SPOTIFY AB Stockholm", amount: 159, type: "expense", cat: "Subscriptions", merchant: "SPOTIFY" },
        { date: "2026-02-08", desc: "NETFLIX International", amount: 329, type: "expense", cat: "Subscriptions", merchant: "NETFLIX" },
        // Transport
        { date: "2026-02-03", desc: "DPP MONTHLY PASS", amount: 670, type: "expense", cat: "Transportation", merchant: "DPP" },
        { date: "2026-02-11", desc: "BOLT Technology OD Praha", amount: 189, type: "expense", cat: "Transportation", merchant: "BOLT" },
        { date: "2026-02-18", desc: "BOLT Technology OD Praha", amount: 220, type: "expense", cat: "Transportation", merchant: "BOLT" },
        // Dining
        { date: "2026-02-12", desc: "MC DONALDS PALLADIUM", amount: 245, type: "expense", cat: "Food & Dining", merchant: "MC_DONALDS" },
        { date: "2026-02-20", desc: "MC DONALDS LETŇANY", amount: 185, type: "expense", cat: "Food & Dining", merchant: "MC_DONALDS" },
        { date: "2026-02-15", desc: "Pizzeria Bella Italia", amount: 520, type: "expense", cat: "Food & Dining", merchant: null },
        { date: "2026-02-22", desc: "Starbucks Coffee", amount: 135, type: "expense", cat: "Food & Dining", merchant: null },
        // Shopping / other
        { date: "2026-02-13", desc: "H&M Praha online", amount: 1290, type: "expense", cat: "Shopping", merchant: null },
        { date: "2026-02-19", desc: "Alza.cz nakup", amount: 890, type: "expense", cat: "Shopping", merchant: null },
    ];

    for (const tx of txns) {
        const r = new Record(txColl);
        r.set("description", tx.desc);
        r.set("raw_description", tx.desc);
        r.set("amount", tx.amount);
        r.set("type", tx.type);
        r.set("currency", "CZK");
        r.set("date", tx.date + " 12:00:00.000Z");
        r.set("account", checkingId);
        r.set("category_rel", catMap[tx.cat] || "");
        if (tx.merchant && merMap[tx.merchant]) {
            r.set("merchant", merMap[tx.merchant]);
        }
        r.set("is_expense", tx.type === "expense");
        r.set("workspace", wsId);
        app.save(r);
    }

    // ── 8. Income source ──────────────────────────────────────────────────────
    const incSrcColl = app.findCollectionByNameOrId("finance_income_sources");
    const inc = new Record(incSrcColl);
    inc.set("name", "Zaměstnání");
    inc.set("income_type", "fixed");
    inc.set("amount", 68000);
    inc.set("currency", "CZK");
    inc.set("is_active", true);
    inc.set("workspace", wsId);
    app.save(inc);

    const incFreelance = new Record(incSrcColl);
    incFreelance.set("name", "Freelance");
    incFreelance.set("income_type", "fixed");
    incFreelance.set("amount", 12000);
    incFreelance.set("currency", "CZK");
    incFreelance.set("is_active", true);
    incFreelance.set("workspace", wsId);
    app.save(incFreelance);

    // ── 9. Budget groups + items ──────────────────────────────────────────────
    const bgColl = app.findCollectionByNameOrId("finance_budgets");
    const biColl = app.findCollectionByNameOrId("finance_budget_items");

    const budgetGroups = [
        {
            name: "🏠 Bydlení", icon: "🏠", color: "#6366f1", sort_order: 1,
            items: [
                { name: "Hypotéka", budgeted: 18500, freq: "monthly", pattern: "HYPOTEKA", pattern_type: "contains", field: "description", cat: "Housing" },
                { name: "Elektřina", budgeted: 2500, freq: "monthly", pattern: "E.ON", pattern_type: "contains", field: "description", cat: "Housing" },
            ],
        },
        {
            name: "🛒 Jídlo", icon: "🛒", color: "#22c55e", sort_order: 2,
            items: [
                { name: "Groceries", budgeted: 8000, freq: "monthly", pattern: "", pattern_type: "", field: "", cat: "Groceries" },
                { name: "Restaurace", budgeted: 3000, freq: "monthly", pattern: "", pattern_type: "", field: "", cat: "Food & Dining" },
            ],
        },
        {
            name: "🚗 Doprava", icon: "🚗", color: "#3b82f6", sort_order: 3,
            items: [
                { name: "MHD Praha", budgeted: 670, freq: "monthly", pattern: "DPP", pattern_type: "contains", field: "description", cat: "Transportation" },
                { name: "Bolt", budgeted: 600, freq: "monthly", pattern: "BOLT", pattern_type: "contains", field: "description", cat: "Transportation" },
            ],
        },
        {
            name: "📱 Předplatné", icon: "📱", color: "#f97316", sort_order: 4,
            items: [
                { name: "Spotify", budgeted: 159, freq: "monthly", pattern: "SPOTIFY", pattern_type: "contains", field: "description", cat: "Subscriptions" },
                { name: "Netflix", budgeted: 329, freq: "monthly", pattern: "NETFLIX", pattern_type: "contains", field: "description", cat: "Subscriptions" },
            ],
        },
        {
            name: "🛍️ Nakupování", icon: "🛍️", color: "#8b5cf6", sort_order: 5,
            items: [
                { name: "Oblečení & věci", budgeted: 2000, freq: "monthly", pattern: "", pattern_type: "", field: "", cat: "Shopping" },
            ],
        },
    ];

    for (const group of budgetGroups) {
        const bg = new Record(bgColl);
        bg.set("name", group.name);
        bg.set("icon", group.icon);
        bg.set("color", group.color);
        bg.set("sort_order", group.sort_order);
        bg.set("is_active", true);
        bg.set("workspace", wsId);
        app.save(bg);

        for (let i = 0; i < group.items.length; i++) {
            const item = group.items[i];
            const bi = new Record(biColl);
            bi.set("budget", bg.id);
            bi.set("name", item.name);
            bi.set("budgeted_amount", item.budgeted);
            bi.set("currency", "CZK");
            bi.set("frequency", item.freq);
            bi.set("match_pattern", item.pattern);
            bi.set("match_pattern_type", item.pattern_type);
            bi.set("match_field", item.field);
            bi.set("match_category", catMap[item.cat] || "");
            bi.set("is_expense", true);
            bi.set("sort_order", i);
            bi.set("is_active", true);
            bi.set("workspace", wsId);
            app.save(bi);
        }
    }

    console.log("✅ Demo seed complete! Login with test@test.com / testtest");

}, (app) => {
    // Down: remove demo user and workspace
    try {
        const user = app.findAuthRecordByEmail("_pb_users_auth_", "test@test.com");
        if (user) app.delete(user);
    } catch (e) { }
});
