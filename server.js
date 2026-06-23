const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const storageDir = path.resolve(process.env.STORAGE_DIR || path.join(root, "storage"));
const uploadDir = path.join(storageDir, "uploads");
const databasePath = path.join(storageDir, "database.json");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8"
};

const starterData = {
  assets: [],
  beneficiaries: [],
  timeline: [],
  auditLog: []
};

function ensureStorage() {
  fs.mkdirSync(uploadDir, { recursive: true });
  if (!fs.existsSync(databasePath)) {
    fs.writeFileSync(databasePath, JSON.stringify(starterData, null, 2));
  }
}

function loadDatabase() {
  ensureStorage();
  const database = JSON.parse(fs.readFileSync(databasePath, "utf8"));
  database.assets = (database.assets || []).filter((asset) => !String(asset.id).startsWith("sample-"));
  database.beneficiaries = (database.beneficiaries || []).filter((person) => !String(person.id).startsWith("beneficiary-"));
  database.timeline = database.timeline || [];
  database.auditLog = database.auditLog || [];
  return database;
}

function saveDatabase(database) {
  ensureStorage();
  fs.writeFileSync(databasePath, JSON.stringify(database, null, 2));
}

function addAudit(database, action, detail) {
  database.auditLog = database.auditLog || [];
  database.auditLog.unshift({
    id: crypto.randomUUID(),
    action,
    detail,
    createdAt: new Date().toISOString()
  });
  database.auditLog = database.auditLog.slice(0, 200);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, status, html) {
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseMultipart(buffer, contentType) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!boundaryMatch) throw new Error("Missing multipart boundary");

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const parts = [];
  let cursor = buffer.indexOf(boundary);

  while (cursor !== -1) {
    cursor += boundary.length;
    if (buffer[cursor] === 45 && buffer[cursor + 1] === 45) break;
    if (buffer[cursor] === 13 && buffer[cursor + 1] === 10) cursor += 2;

    const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), cursor);
    if (headerEnd === -1) break;

    const rawHeaders = buffer.slice(cursor, headerEnd).toString("utf8");
    const nextBoundary = buffer.indexOf(boundary, headerEnd + 4);
    if (nextBoundary === -1) break;

    let body = buffer.slice(headerEnd + 4, nextBoundary);
    if (body.length >= 2 && body[body.length - 2] === 13 && body[body.length - 1] === 10) {
      body = body.slice(0, -2);
    }

    const disposition = /content-disposition:\s*form-data;([^\r\n]+)/i.exec(rawHeaders);
    const nameMatch = disposition && /name="([^"]+)"/i.exec(disposition[1]);
    const fileMatch = disposition && /filename="([^"]*)"/i.exec(disposition[1]);
    const typeMatch = /content-type:\s*([^\r\n]+)/i.exec(rawHeaders);

    parts.push({
      name: nameMatch ? nameMatch[1] : "",
      filename: fileMatch ? path.basename(fileMatch[1]) : "",
      mimeType: typeMatch ? typeMatch[1].trim() : "application/octet-stream",
      data: body
    });

    cursor = nextBoundary;
  }

  return parts;
}

function sanitizeFileName(name) {
  return name.replace(/[^a-zA-Z0-9._ -]/g, "_").replace(/\s+/g, " ").trim() || "asset";
}

function isReadableText(name, mimeType) {
  const extension = path.extname(name).toLowerCase();
  return (
    mimeType.startsWith("text/") ||
    [".txt", ".csv", ".json", ".md", ".html", ".xml", ".eml", ".log"].includes(extension)
  );
}

function extractText(name, mimeType, data) {
  if (!isReadableText(name, mimeType)) return "";
  return data.toString("utf8").replace(/\0/g, " ").slice(0, 20000);
}

function classifyAsset(name, text) {
  const haystack = `${name} ${text}`.toLowerCase();
  const checks = [
    ["Insurance", ["insurance", "policy", "premium", "nominee", "coverage", "claim"]],
    ["Financial", ["bank", "statement", "mutual fund", "folio", "sip", "investment", "portfolio", "loan", "account"]],
    ["Legal", ["property", "agreement", "registration", "will", "deed", "contract", "legal"]],
    ["Subscription", ["subscription", "receipt", "invoice", "recurring", "netflix", "spotify", "membership"]],
    ["Medical", ["medical", "health", "hospital", "diagnosis", "doctor", "prescription", "lab"]],
    ["Memory", ["photo", "album", "trip", "travel", "birthday", "wedding", "family", "graduation"]]
  ];

  let best = { category: "Personal", score: 0 };
  for (const [category, words] of checks) {
    const score = words.reduce((total, word) => total + (haystack.includes(word) ? 1 : 0), 0);
    if (score > best.score) best = { category, score };
  }

  return {
    category: best.category,
    confidence: Math.min(96, Math.max(55, 62 + best.score * 9))
  };
}

function sensitivityFor(category) {
  if (["Financial", "Insurance", "Legal", "Medical"].includes(category)) return "High";
  if (category === "Subscription") return "Medium";
  if (category === "Memory") return "Private";
  return "Needs review";
}

function extractEntities(text) {
  const entities = [];
  const amountMatches = text.match(/(?:rs\.?|inr|\$)\s?[0-9][0-9,]*(?:\.[0-9]{1,2})?/gi) || [];
  const dateMatches = text.match(/\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}-\d{2}-\d{2})\b/g) || [];
  const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const accountMatches = text.match(/\b(?:account|policy|folio|invoice)\s*(?:no\.?|number|id)?\s*[:#-]?\s*[a-zA-Z0-9-]{4,}\b/gi) || [];

  for (const value of [...new Set(amountMatches)].slice(0, 3)) entities.push(`Amount: ${value}`);
  for (const value of [...new Set(dateMatches)].slice(0, 3)) entities.push(`Date: ${value}`);
  for (const value of [...new Set(emailMatches)].slice(0, 2)) entities.push(`Email: ${value}`);
  for (const value of [...new Set(accountMatches)].slice(0, 3)) entities.push(value);

  return entities.length ? entities : ["No structured entities found yet", "Manual review recommended"];
}

function makeSummary(assetName, category, text) {
  const readable = text.replace(/\s+/g, " ").trim();
  if (readable) {
    return `${category} asset ingested and indexed. Preview: ${readable.slice(0, 220)}${readable.length > 220 ? "..." : ""}`;
  }
  return `${category} asset saved securely. Text extraction is not available for this file type yet, so manual review or OCR integration is required.`;
}

function createAsset(file) {
  const hash = crypto.createHash("sha256").update(file.data).digest("hex");
  const cleanName = sanitizeFileName(file.filename || "asset.bin");
  const extension = path.extname(cleanName);
  const id = crypto.randomUUID();
  const storedName = `${id}${extension}`;
  const text = extractText(cleanName, file.mimeType, file.data);
  const classification = classifyAsset(cleanName, text);
  const now = new Date();

  fs.writeFileSync(path.join(uploadDir, storedName), file.data);

  return {
    id,
    name: cleanName,
    storedName,
    source: "Manual upload",
    category: classification.category,
    date: now.toISOString().slice(0, 10),
    confidence: classification.confidence,
    sensitivity: sensitivityFor(classification.category),
    size: file.data.length,
    mimeType: file.mimeType,
    hash,
    textPreview: text.slice(0, 1200),
    summary: makeSummary(cleanName, classification.category, text),
    entities: extractEntities(text),
    reviewed: false,
    createdAt: now.toISOString()
  };
}

function buildTimeline(assets) {
  return assets
    .filter((asset) => asset.category === "Memory")
    .map((asset) => ({
      id: `event-${asset.id}`,
      date: asset.date.slice(0, 4),
      title: asset.name.replace(/\.[^.]+$/, ""),
      confidence: asset.confidence,
      text: `Generated from uploaded memory asset "${asset.name}". Add OCR, EXIF, and face recognition to enrich this event.`
    }));
}

function buildFindings(assets) {
  const counts = assets.reduce((result, asset) => {
    result[asset.category] = (result[asset.category] || 0) + 1;
    return result;
  }, {});
  const findings = [];
  if (counts.Insurance) findings.push(["Insurance records found", `${counts.Insurance} insurance asset(s) are available for nominee and premium review.`]);
  if (counts.Subscription) findings.push(["Subscriptions detected", `${counts.Subscription} subscription or receipt asset(s) may contain recurring payments.`]);
  if (counts.Financial) findings.push(["Financial assets found", `${counts.Financial} financial document(s) are ready for executor review.`]);
  if (counts.Legal) findings.push(["Legal documents found", `${counts.Legal} legal asset(s) should be verified against originals.`]);
  if (!findings.length) findings.push(["Vault ready", "Upload files to begin classification, search, and inheritance reporting."]);
  return findings;
}

function publicState() {
  const database = loadDatabase();
  const assets = database.assets;
  return {
    assets,
    beneficiaries: database.beneficiaries,
    timeline: [...database.timeline, ...buildTimeline(assets)],
    auditLog: database.auditLog.slice(0, 20),
    findings: buildFindings(assets),
    metrics: {
      totalAssets: assets.length,
      highConfidence: assets.filter((asset) => asset.confidence >= 85).length,
      recurringPayments: assets.filter((asset) => asset.category === "Subscription").length,
      beneficiaries: database.beneficiaries.length
    }
  };
}

function searchEstate(question) {
  const database = loadDatabase();
  const terms = question.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2);
  const scored = database.assets
    .map((asset) => {
      const haystack = `${asset.name} ${asset.category} ${asset.summary} ${asset.entities.join(" ")} ${asset.textPreview}`.toLowerCase();
      const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
      return { asset, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (!scored.length) {
    return {
      answer: "I searched the saved estate, but did not find a matching asset. Try terms such as insurance, bank, policy, receipt, property, medical, or photo.",
      sources: []
    };
  }

  const sources = scored.map((item) => ({
    id: item.asset.id,
    name: item.asset.name,
    category: item.asset.category,
    summary: item.asset.summary
  }));

  return {
    answer: `I found ${sources.length} matching asset(s): ${sources.map((source) => `${source.name} (${source.category})`).join(", ")}.`,
    sources
  };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReport(sections) {
  const database = loadDatabase();
  const enabled = new Set(sections && sections.length ? sections : ["financial", "legal", "insurance", "memory", "medical", "subscription"]);
  const sectionMap = {
    financial: "Financial",
    legal: "Legal",
    insurance: "Insurance",
    memory: "Memory",
    medical: "Medical",
    subscription: "Subscription"
  };

  const rows = Object.entries(sectionMap)
    .filter(([key]) => enabled.has(key))
    .map(([, category]) => {
      const assets = database.assets.filter((asset) => asset.category === category);
      const body = assets.length
        ? `<ul>${assets.map((asset) => `<li><strong>${escapeHtml(asset.name)}</strong>: ${escapeHtml(asset.summary)}</li>`).join("")}</ul>`
        : `<p>No ${escapeHtml(category.toLowerCase())} assets uploaded yet.</p>`;
      return `<section><h2>${escapeHtml(category)} Assets</h2>${body}</section>`;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Digital Estate Report</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.5; color: #1c2430; padding: 32px; }
    section { border-top: 1px solid #dce3ea; margin-top: 20px; padding-top: 16px; }
    h1, h2 { margin-bottom: 8px; }
  </style>
</head>
<body>
  <h1>Digital Estate Report</h1>
  <p>Generated from locally uploaded and indexed assets. Classifications are heuristic until OCR and LLM providers are connected.</p>
  ${rows}
</body>
</html>`;
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method === "GET" && pathname === "/api/state") {
      sendJson(res, 200, publicState());
      return;
    }

    if (req.method === "POST" && pathname === "/api/assets") {
      const body = await readRequestBody(req);
      const parts = parseMultipart(body, req.headers["content-type"]);
      const files = parts.filter((part) => part.filename);
      if (!files.length) {
        sendJson(res, 400, { error: "No files uploaded" });
        return;
      }

      const database = loadDatabase();
      const assets = files.map(createAsset);
      database.assets.unshift(...assets);
      addAudit(database, "asset.uploaded", `${assets.length} file(s) uploaded and indexed.`);
      saveDatabase(database);
      sendJson(res, 201, { assets, state: publicState() });
      return;
    }

    if (req.method === "POST" && pathname === "/api/chat") {
      const body = JSON.parse((await readRequestBody(req)).toString("utf8") || "{}");
      const database = loadDatabase();
      addAudit(database, "estate.searched", `Question: ${(body.question || "").slice(0, 120)}`);
      saveDatabase(database);
      sendJson(res, 200, searchEstate(body.question || ""));
      return;
    }

    if (req.method === "POST" && pathname === "/api/report") {
      const body = JSON.parse((await readRequestBody(req)).toString("utf8") || "{}");
      const database = loadDatabase();
      addAudit(database, "report.generated", `Sections: ${(body.sections || []).join(", ") || "all"}`);
      saveDatabase(database);
      sendHtml(res, 200, buildReport(body.sections));
      return;
    }

    if (req.method === "POST" && pathname === "/api/beneficiaries") {
      const body = JSON.parse((await readRequestBody(req)).toString("utf8") || "{}");
      const name = String(body.name || "").trim();
      const role = String(body.role || "").trim();
      const access = Array.isArray(body.access) ? body.access.map(String).filter(Boolean) : [];
      if (!name || !role || !access.length) {
        sendJson(res, 400, { error: "Name, role, and at least one access scope are required" });
        return;
      }
      const database = loadDatabase();
      const beneficiary = {
        id: crypto.randomUUID(),
        name,
        role,
        access,
        status: "Needs verification",
        createdAt: new Date().toISOString()
      };
      database.beneficiaries.unshift(beneficiary);
      addAudit(database, "beneficiary.created", `${beneficiary.name} added with ${access.join(", ")} access.`);
      saveDatabase(database);
      sendJson(res, 201, { beneficiary, state: publicState() });
      return;
    }

    const beneficiaryDeleteMatch = pathname.match(/^\/api\/beneficiaries\/([^/]+)$/);
    if (req.method === "DELETE" && beneficiaryDeleteMatch) {
      const database = loadDatabase();
      const before = database.beneficiaries.length;
      const removed = database.beneficiaries.find((item) => item.id === beneficiaryDeleteMatch[1]);
      database.beneficiaries = database.beneficiaries.filter((item) => item.id !== beneficiaryDeleteMatch[1]);
      if (database.beneficiaries.length === before) {
        sendJson(res, 404, { error: "Beneficiary not found" });
        return;
      }
      addAudit(database, "beneficiary.deleted", `${removed.name} removed.`);
      saveDatabase(database);
      sendJson(res, 200, { state: publicState() });
      return;
    }

    const reviewMatch = pathname.match(/^\/api\/assets\/([^/]+)\/review$/);
    if (req.method === "POST" && reviewMatch) {
      const database = loadDatabase();
      const asset = database.assets.find((item) => item.id === reviewMatch[1]);
      if (!asset) {
        sendJson(res, 404, { error: "Asset not found" });
        return;
      }
      asset.reviewed = true;
      addAudit(database, "asset.reviewed", `${asset.name} marked reviewed.`);
      saveDatabase(database);
      sendJson(res, 200, { asset, state: publicState() });
      return;
    }

    const assetDeleteMatch = pathname.match(/^\/api\/assets\/([^/]+)$/);
    if (req.method === "DELETE" && assetDeleteMatch) {
      const database = loadDatabase();
      const asset = database.assets.find((item) => item.id === assetDeleteMatch[1]);
      if (!asset) {
        sendJson(res, 404, { error: "Asset not found" });
        return;
      }
      database.assets = database.assets.filter((item) => item.id !== asset.id);
      if (asset.storedName) {
        const filePath = path.join(uploadDir, asset.storedName);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      addAudit(database, "asset.deleted", `${asset.name} deleted.`);
      saveDatabase(database);
      sendJson(res, 200, { state: publicState() });
      return;
    }

    const downloadMatch = pathname.match(/^\/api\/assets\/([^/]+)\/download$/);
    if (req.method === "GET" && downloadMatch) {
      const database = loadDatabase();
      const asset = database.assets.find((item) => item.id === downloadMatch[1]);
      if (!asset || !asset.storedName) {
        sendJson(res, 404, { error: "Asset file not found" });
        return;
      }
      const filePath = path.join(uploadDir, asset.storedName);
      const auditDatabase = loadDatabase();
      addAudit(auditDatabase, "asset.downloaded", `${asset.name} downloaded.`);
      saveDatabase(auditDatabase);
      res.writeHead(200, {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asset.name.replace(/"/g, "")}"`
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    sendJson(res, 404, { error: "API route not found" });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
}

function resolveStaticPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const requested = cleanPath === "/" ? "/index.html" : cleanPath;
  const filePath = path.normalize(path.join(root, requested));
  if (!filePath.startsWith(root)) return null;
  return filePath;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url.pathname);
    return;
  }

  if (url.pathname === "/healthz") {
    sendJson(res, 200, {
      ok: true,
      storageDir,
      uptimeSeconds: Math.round(process.uptime())
    });
    return;
  }

  const filePath = resolveStaticPath(url.pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": contentTypes[extension] || "application/octet-stream" });
    res.end(data);
  });
});

ensureStorage();
server.listen(port, "0.0.0.0", () => {
  console.log(`Digital Legacy Manager running at http://localhost:${port}`);
  console.log(`Using storage directory: ${storageDir}`);
});
