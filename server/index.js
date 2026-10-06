import express from "express";
import path from "node:path";

const app = express();
const PORT = process.env.PORT || 3000;

const distPath = path.join(import.meta.dirname, "../dist");

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", serverTime: new Date() });
});

app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
