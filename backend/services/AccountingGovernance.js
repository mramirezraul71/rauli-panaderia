import { emitAtlasEvent } from './AtlasBridge.js';

const ATLAS_BASE_URL = (process.env.ATLAS_BASE_URL || 'http://127.0.0.1:8791').replace(/\/+$/, '');
const ATLAS_DECISION_URL = `${ATLAS_BASE_URL}/api/feedback/decide`;
const ATLAS_DECISION_TIMEOUT_MS = Number(process.env.ATLAS_ACCOUNTING_DECISION_TIMEOUT_MS || 2500);
const ATLAS_DECISION_ENABLED = !['0', 'false', 'no', 'off']
  .includes(String(process.env.ATLAS_ACCOUNTING_DECISION_ENABLED ?? 'true').toLowerCase().trim());
const MAJOR_AMOUNT_THRESHOLD = Number(process.env.ATLAS_ACCOUNTING_MAJOR_AMOUNT || 5000);

const STRUCTURAL_ACTIONS = new Set([
  'account_create',
  'account_update',
  'account_delete',
  'investment_create',
  'investment_update'
]);

const fetchJsonWithTimeout = async (url, payload, timeoutMs = 2500) => {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
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

const localDecision = (event = {}) => {
  const action = String(event.action || 'unknown');
  const amount = Number(event.amount || 0);
  const structural = STRUCTURAL_ACTIONS.has(action);
  const majorAmount = Number.isFinite(amount) && amount >= MAJOR_AMOUNT_THRESHOLD;
  const requiresOwnerApproval = structural || majorAmount;

  return {
    decision: requiresOwnerApproval ? 'wait_owner_approval' : 'auto_fix_now',
    status: requiresOwnerApproval ? 'pending_owner_approval' : 'auto_resolved',
    auto_execute: !requiresOwnerApproval,
    requires_owner_approval: requiresOwnerApproval,
    approval_id: null,
    decision_source: 'local_policy',
    reason: structural ? 'structural_change' : (majorAmount ? 'major_amount' : 'routine'),
    user_message: requiresOwnerApproval
      ? 'ATLAS requiere aprobacion del Owner antes de aplicar este cambio.'
      : 'ATLAS autorizo la ejecucion automatica del evento contable.'
  };
};

const atlasDecision = async (event, fallback) => {
  const severity = fallback.requires_owner_approval ? 'high' : 'medium';
  const description = `Accounting event=${event.action} mode=${event.mode || 'unknown'} amount=${Number(event.amount || 0)} payload=${JSON.stringify(event.payload || {})}`;

  const body = {
    source_app: 'rauli-panaderia',
    feedback: {
      type: 'accounting_event',
      category: 'accounting',
      title: `Accounting governance: ${event.action}`,
      description,
      severity
    },
    analysis: {
      detected_issue: event.action,
      root_cause: event.mode || 'unspecified',
      recommended_action: fallback.reason,
      auto_fix: fallback.auto_execute,
      priority: severity
    }
  };

  const resp = await fetchJsonWithTimeout(ATLAS_DECISION_URL, body, ATLAS_DECISION_TIMEOUT_MS);
  if (!resp.ok || !resp.data?.ok) {
    return null;
  }

  return {
    decision: resp.data.decision || fallback.decision,
    status: resp.data.status || fallback.status,
    auto_execute: Boolean(resp.data.auto_execute),
    requires_owner_approval: Boolean(resp.data.requires_owner_approval),
    approval_id: resp.data.approval_id || null,
    decision_source: 'atlas',
    reason: fallback.reason,
    user_message: resp.data.user_message || fallback.user_message
  };
};

export async function decideAccountingAction(event = {}) {
  const fallback = localDecision(event);
  if (!ATLAS_DECISION_ENABLED) {
    return fallback;
  }

  try {
    const decided = await atlasDecision(event, fallback);
    return decided || fallback;
  } catch {
    return fallback;
  }
}

export async function routeAccountingEvent(event = {}) {
  const decision = await decideAccountingAction(event);
  await emitAtlasEvent({
    message: `Accounting event ${event.action || 'unknown'} (${event.mode || 'unknown'})`,
    level: decision.requires_owner_approval ? 'med' : 'low',
    subsystem: 'panaderia.accounting',
    data: {
      action: event.action || 'unknown',
      mode: event.mode || 'unknown',
      amount: Number(event.amount || 0),
      payload: event.payload || {},
      decision
    }
  });
  return decision;
}

