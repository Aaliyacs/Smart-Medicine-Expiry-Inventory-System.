import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("pharma.db");

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    medicine_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/inventory", (req, res) => {
    const rows = db.prepare("SELECT * FROM inventory ORDER BY expiry_date ASC").all();
    res.json(rows);
  });

  app.post("/api/inventory", (req, res) => {
    const { name, batch_number, expiry_date, quantity } = req.body;
    
    // Safety check for date parsing - Ensure UTC
    const date = new Date(expiry_date);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ error: "Invalid expiry date format" });
    }
    
    const utcExpiry = date.toISOString().split('T')[0];

    const stmt = db.prepare("INSERT INTO inventory (name, batch_number, expiry_date, quantity) VALUES (?, ?, ?, ?)");
    stmt.run(name, batch_number, utcExpiry, quantity);
    
    db.prepare("INSERT INTO audit_logs (action, medicine_name, quantity) VALUES (?, ?, ?)")
      .run("ADD_STOCK", name, quantity);

    res.json({ success: true });
  });

  app.post("/api/dispense", (req, res) => {
    const { name, quantity } = req.body;
    let remainingToDispense = quantity;

    // FIFO Logic: Get batches of the medicine ordered by expiry date
    const batches = db.prepare("SELECT * FROM inventory WHERE name = ? AND quantity > 0 ORDER BY expiry_date ASC").all(name) as any[];

    const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);
    if (totalAvailable < quantity) {
      return res.status(400).json({ error: "Insufficient stock" });
    }

    const transaction = db.transaction(() => {
      for (const batch of batches) {
        if (remainingToDispense <= 0) break;

        const dispenseFromBatch = Math.min(batch.quantity, remainingToDispense);
        db.prepare("UPDATE inventory SET quantity = quantity - ? WHERE id = ?")
          .run(dispenseFromBatch, batch.id);
        
        remainingToDispense -= dispenseFromBatch;
      }

      db.prepare("INSERT INTO audit_logs (action, medicine_name, quantity) VALUES (?, ?, ?)")
        .run("DISPENSE", name, quantity);
    });

    transaction();
    res.json({ success: true });
  });

  app.get("/api/alerts", (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const expiringSoon = db.prepare("SELECT * FROM inventory WHERE expiry_date <= ? AND quantity > 0").all(thirtyDaysFromNow);
    res.json(expiringSoon);
  });

  app.get("/api/logs", (req, res) => {
    const logs = db.prepare("SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100").all();
    res.json(logs);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
