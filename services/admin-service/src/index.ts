import express from "express";
import { Pool } from "pg";

const app = express();
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "service_token";

app.post("/admin/audit", async (req, res) => {
  const svc = req.headers["x-service-token"];
  if (svc !== SERVICE_TOKEN) return res.status(401).json({ error: "no service token" });
  const { user_id, action, service, resource_id, payload } = req.body;
  await pool.query("INSERT INTO audit_logs (user_id,action,service,resource_id,payload) VALUES($1,$2,$3,$4,$5)", [user_id, action, service, resource_id, payload || {}]);
  res.json({ ok: true });
});

app.get("/admin/audit", async (req, res) => {
  const r = await pool.query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200");
  res.json(r.rows);
});

const port = parseInt(process.env.PORT || "3007", 10);
app.listen(port, () => console.log(`Admin service on ${port}`));