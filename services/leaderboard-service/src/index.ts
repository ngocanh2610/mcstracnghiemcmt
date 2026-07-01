import express from "express";
import { Pool } from "pg";

const app = express();
app.use(express.json());
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || "service_token";

app.post("/leaderboard/update", async (req, res) => {
  const svc = req.headers["x-service-token"];
  if (svc !== SERVICE_TOKEN) return res.status(401).json({ error: "no service token" });
  const { exam_id, user_id, score } = req.body;
  await pool.query("INSERT INTO leaderboard_entries (exam_id,user_id,score) VALUES($1,$2,$3)", [exam_id, user_id, score]);
  res.json({ ok: true });
});

app.get("/leaderboard", async (req, res) => {
  const { exam_id, limit } = req.query;
  if (!exam_id) return res.status(400).json({ error: "exam_id required" });
  const lim = parseInt((limit as string) || "10", 10);
  const r = await pool.query("SELECT user_id, score FROM leaderboard_entries WHERE exam_id=$1 ORDER BY score DESC LIMIT $2", [exam_id, lim]);
  res.json(r.rows);
});

const port = parseInt(process.env.PORT || "3006", 10);
app.listen(port, () => console.log(`Leaderboard service on ${port}`));