import express from "express";

const router = express.Router();

const DEFAULT_ATLAS_BASE_URL = "http://127.0.0.1:8791";
const atlasBaseUrl = () =>
  String(process.env.ATLAS_BASE_URL || DEFAULT_ATLAS_BASE_URL).replace(/\/+$/, "");

const withTimeoutJson = async (url, options = {}, timeoutMs = 20000) => {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(tid);
  }
};

router.post("/brain", async (req, res) => {
  const feedback = req.body?.feedback && typeof req.body.feedback === "object"
    ? req.body.feedback
    : req.body;
  const analysis = req.body?.analysis && typeof req.body.analysis === "object"
    ? req.body.analysis
    : null;

  if (!feedback || typeof feedback !== "object") {
    return res.status(400).json({
      success: false,
      message: "Payload de feedback inválido."
    });
  }

  const payload = {
    source_app: "rauli-panaderia",
    feedback,
    analysis
  };

  try {
    const atlasResp = await withTimeoutJson(
      `${atlasBaseUrl()}/api/feedback/decide`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      },
      20000
    );
    if (!atlasResp.ok || !atlasResp.data?.ok) {
      return res.status(502).json({
        success: false,
        message: "ATLAS no pudo decidir en este momento. El reporte fue registrado.",
        decision: "wait_owner_approval",
        status: "pending_owner_approval",
        approvalId: null
      });
    }

    return res.status(200).json({
      success: true,
      message: atlasResp.data.user_message || "Feedback procesado por ATLAS.",
      decision: atlasResp.data.decision || "wait_owner_approval",
      status: atlasResp.data.status || "pending_owner_approval",
      autoExecute: Boolean(atlasResp.data.auto_execute),
      requiresOwnerApproval: Boolean(atlasResp.data.requires_owner_approval),
      approvalId: atlasResp.data.approval_id || null,
      timestamp: atlasResp.data.timestamp || new Date().toISOString()
    });
  } catch (error) {
    return res.status(502).json({
      success: false,
      message: "No se pudo contactar a ATLAS. El feedback quedó registrado para revisión.",
      decision: "wait_owner_approval",
      status: "pending_owner_approval",
      approvalId: null,
      error: error?.message || "atlas_unreachable"
    });
  }
});

router.get("/stats", (req, res) => {
  return res.json({
    success: true,
    source: "rauli-panaderia",
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

export default router;
