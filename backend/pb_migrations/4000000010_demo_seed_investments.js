/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
    // ── Guard: find demo user & workspace ────────────────────────────────────
    let demoUser;
    try {
        demoUser = app.findAuthRecordByEmail("_pb_users_auth_", "test@test.com");
    } catch (e) { /* not found */ }

    if (!demoUser) {
        console.log("Demo user not found — skipping investment seed.");
        return;
    }

    // Find the demo workspace
    const workspaces = app.findRecordsByFilter('workspaces', `name = 'Demo Workspace'`, '', 1, 0);
    if (!workspaces || workspaces.length === 0) {
        console.log("Demo workspace not found — skipping investment seed.");
        return;
    }
    const wsId = workspaces[0].id;

    // Idempotent guard — skip if portfolios already exist
    const existing = app.findRecordsByFilter('investment_portfolios', `workspace = '${wsId}'`, '', 1, 0);
    if (existing && existing.length > 0) {
        console.log("Investment data already seeded — skipping.");
        return;
    }

    console.log("Seeding investment data for demo workspace...");

    const portColl = app.findCollectionByNameOrId("investment_portfolios");
    const snapColl = app.findCollectionByNameOrId("investment_snapshots");
    const holdColl = app.findCollectionByNameOrId("investment_holdings");

    // ── Portfolio 1: Fondee — Global ETF mix ─────────────────────────────────
    const fondee = new Record(portColl);
    fondee.set("name", "Fondee Global ETF");
    fondee.set("provider", "fondee");
    fondee.set("contract_id", "FND-20210314-001");
    fondee.set("currency", "CZK");
    fondee.set("workspace", wsId);
    app.save(fondee);

    // ── Portfolio 2: Amundi — S&P 500 ────────────────────────────────────────
    const amundi = new Record(portColl);
    amundi.set("name", "Amundi S&P 500");
    amundi.set("provider", "amundi");
    amundi.set("contract_id", "AMU-20220601-002");
    amundi.set("currency", "CZK");
    amundi.set("workspace", wsId);
    app.save(amundi);

    // ── Snapshots: 12 monthly snapshots (Mar 2025 – Feb 2026) ────────────────
    // Fondee: started at ~120k, grew to ~162k with ~8k monthly deposits
    const fondeeSnapshots = [
        { month: "2025-03", start: 110000, end: 118200, invested: 112000, gain: 6200, fees: 180 },
        { month: "2025-04", start: 118200, end: 122500, invested: 120000, gain: 2500, fees: 185 },
        { month: "2025-05", start: 122500, end: 131800, invested: 128000, gain: 3800, fees: 190 },
        { month: "2025-06", start: 131800, end: 128900, invested: 136000, gain: -7100, fees: 195 }, // down month
        { month: "2025-07", start: 128900, end: 138400, invested: 144000, gain: -5600, fees: 195 },
        { month: "2025-08", start: 138400, end: 146200, invested: 152000, gain: -5800, fees: 200 },
        { month: "2025-09", start: 146200, end: 152800, invested: 160000, gain: -7200, fees: 210 },
        { month: "2025-10", start: 152800, end: 160400, invested: 168000, gain: -7600, fees: 215 },
        { month: "2025-11", start: 160400, end: 171200, invested: 176000, gain: -4800, fees: 220 },
        { month: "2025-12", start: 171200, end: 178900, invested: 184000, gain: -5100, fees: 225 },
        { month: "2026-01", start: 178900, end: 187300, invested: 192000, gain: -4700, fees: 230 },
        { month: "2026-02", start: 187300, end: 194800, invested: 200000, gain: -5200, fees: 235 },
    ];

    let lastFondeeSnapId = null;
    for (const s of fondeeSnapshots) {
        const snap = new Record(snapColl);
        snap.set("portfolio", fondee.id);
        snap.set("report_date", s.month + "-28 00:00:00.000Z");
        snap.set("period_start", s.month + "-01 00:00:00.000Z");
        snap.set("period_end", s.month + "-28 00:00:00.000Z");
        snap.set("start_value", s.start);
        snap.set("end_value", s.end);
        snap.set("invested", s.invested);
        snap.set("gain_loss", s.gain);
        snap.set("fees", s.fees);
        snap.set("workspace", wsId);
        app.save(snap);
        lastFondeeSnapId = snap.id;
    }

    // Amundi: started at ~80k, grew to ~118k with ~3k monthly deposits
    const amundiSnapshots = [
        { month: "2025-03", start: 72000, end: 77400, invested: 75000, gain: 2400, fees: 60 },
        { month: "2025-04", start: 77400, end: 80100, invested: 78000, gain: 2100, fees: 62 },
        { month: "2025-05", start: 80100, end: 86300, invested: 81000, gain: 5300, fees: 64 },
        { month: "2025-06", start: 86300, end: 83200, invested: 84000, gain: -800, fees: 66 },
        { month: "2025-07", start: 83200, end: 89800, invested: 87000, gain: 2800, fees: 68 },
        { month: "2025-08", start: 89800, end: 95400, invested: 90000, gain: 5400, fees: 70 },
        { month: "2025-09", start: 95400, end: 100200, invested: 93000, gain: 7200, fees: 72 },
        { month: "2025-10", start: 100200, end: 106800, invested: 96000, gain: 10800, fees: 74 },
        { month: "2025-11", start: 106800, end: 112400, invested: 99000, gain: 13400, fees: 76 },
        { month: "2025-12", start: 112400, end: 117900, invested: 102000, gain: 15900, fees: 78 },
        { month: "2026-01", start: 117900, end: 121300, invested: 105000, gain: 16300, fees: 80 },
        { month: "2026-02", start: 121300, end: 126800, invested: 108000, gain: 18800, fees: 82 },
    ];

    let lastAmundiSnapId = null;
    for (const s of amundiSnapshots) {
        const snap = new Record(snapColl);
        snap.set("portfolio", amundi.id);
        snap.set("report_date", s.month + "-28 00:00:00.000Z");
        snap.set("period_start", s.month + "-01 00:00:00.000Z");
        snap.set("period_end", s.month + "-28 00:00:00.000Z");
        snap.set("start_value", s.start);
        snap.set("end_value", s.end);
        snap.set("invested", s.invested);
        snap.set("gain_loss", s.gain);
        snap.set("fees", s.fees);
        snap.set("workspace", wsId);
        app.save(snap);
        lastAmundiSnapId = snap.id;
    }

    // ── Latest holdings for Fondee (Feb 2026) ────────────────────────────────
    const fondeeHoldings = [
        { name: "iShares Core MSCI World ETF", isin: "IE00B4L5Y983", category: "Equity", units: 52.3, price: 1820.0, total: 95166 },
        { name: "iShares MSCI EM ETF", isin: "IE00B4L5YC18", category: "Equity", units: 28.1, price: 820.0, total: 23042 },
        { name: "Vanguard FTSE Developed ETF", isin: "IE00B3RBWM25", category: "Equity", units: 15.7, price: 2100.0, total: 32970 },
        { name: "iShares Core Global Aggregate", isin: "IE00B3F81R35", category: "Bond", units: 38.4, price: 450.0, total: 17280 },
        { name: "Cash CZK", isin: "", category: "Cash", units: 1.0, price: 26342, total: 26342 },
    ];

    for (const h of fondeeHoldings) {
        const holding = new Record(holdColl);
        holding.set("snapshot", lastFondeeSnapId);
        holding.set("name", h.name);
        holding.set("isin", h.isin);
        holding.set("category", h.category);
        holding.set("units", h.units);
        holding.set("price_per_unit", h.price);
        holding.set("price_currency", "CZK");
        holding.set("total_value", h.total);
        holding.set("value_currency", "CZK");
        holding.set("workspace", wsId);
        app.save(holding);
    }

    // ── Latest holdings for Amundi (Feb 2026) ────────────────────────────────
    const amundiHoldings = [
        { name: "Amundi S&P 500 UCITS ETF", isin: "LU1681048804", category: "Equity", units: 180.5, price: 620.0, total: 111910 },
        { name: "Cash CZK", isin: "", category: "Cash", units: 1.0, price: 14890, total: 14890 },
    ];

    for (const h of amundiHoldings) {
        const holding = new Record(holdColl);
        holding.set("snapshot", lastAmundiSnapId);
        holding.set("name", h.name);
        holding.set("isin", h.isin);
        holding.set("category", h.category);
        holding.set("units", h.units);
        holding.set("price_per_unit", h.price);
        holding.set("price_currency", "CZK");
        holding.set("total_value", h.total);
        holding.set("value_currency", "CZK");
        holding.set("workspace", wsId);
        app.save(holding);
    }

    console.log("✅ Investment seed complete! Fondee ~194 800 Kč, Amundi ~126 800 Kč");
}, (app) => {
    // Down: handled by deleting the demo user / workspace cascade
});
