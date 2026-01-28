/**
 * ══════════════════════════════════════════════════════════════════════════════
 * GENESIS - CASH SESSION MANAGER v1.0
 * ══════════════════════════════════════════════════════════════════════════════
 * Cash drawer management with Blind Close security
 * Inspired by: Square, Toast, Clover POS
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { db, logAudit } from '../services/dataService';
import sentinelService, { ALERT_TYPES } from '../services/SentinelService';

// ══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════════════════════════════

export const SessionStatus = {
  OPEN: 'open',
  CLOSING: 'closing',
  CLOSED: 'closed'
};

export const MovementType = {
  SALE: 'sale',
  REFUND: 'refund',
  CASH_IN: 'cash_in',
  CASH_OUT: 'cash_out',
  OPENING: 'opening'
};

// Dominican Republic denominations
export const DENOMINATIONS = {
  bills: [
    { value: 2000, label: 'RD$2,000', color: 'purple' },
    { value: 1000, label: 'RD$1,000', color: 'green' },
    { value: 500, label: 'RD$500', color: 'blue' },
    { value: 200, label: 'RD$200', color: 'orange' },
    { value: 100, label: 'RD$100', color: 'red' },
    { value: 50, label: 'RD$50', color: 'gray' },
  ],
  coins: [
    { value: 25, label: 'RD$25' },
    { value: 10, label: 'RD$10' },
    { value: 5, label: 'RD$5' },
    { value: 1, label: 'RD$1' },
  ]
};

// ══════════════════════════════════════════════════════════════════════════════
// CASH SESSION CLASS
// ══════════════════════════════════════════════════════════════════════════════

class CashSessionManager {
  
  // ════════════════════════════════════════════════════════════════════════════
  // GET CURRENT SESSION
  // ════════════════════════════════════════════════════════════════════════════
  
  async getCurrentSession() {
    try {
      const sessions = await db.cashSessions
        ?.where('status')
        .equals(SessionStatus.OPEN)
        .toArray() || [];
      
      return sessions[0] || null;
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // OPEN CASH DRAWER (Start of shift)
  // ════════════════════════════════════════════════════════════════════════════
  
  async openDrawer(userId, openingAmount, denominationCount = null) {
    // Check if there's already an open session
    const existingSession = await this.getCurrentSession();
    if (existingSession) {
      throw new Error('Ya hay una caja abierta. Ciérrala primero.');
    }

    const sessionId = `cs_${Date.now()}`;
    const now = new Date().toISOString();

    const session = {
      id: sessionId,
      user_id: userId,
      status: SessionStatus.OPEN,
      
      // Opening
      opening_amount: openingAmount,
      opening_denomination: denominationCount ? JSON.stringify(denominationCount) : null,
      opened_at: now,
      opened_by: userId,
      
      // Running totals (updated with each transaction)
      expected_cash: openingAmount,
      total_sales: 0,
      total_refunds: 0,
      total_cash_in: 0,
      total_cash_out: 0,
      transaction_count: 0,
      
      // Closing (filled at close time)
      declared_amount: null,
      closing_denomination: null,
      variance: null,
      closed_at: null,
      closed_by: null,
      closing_notes: null,
      
      created_at: now
    };

    await db.cashSessions.add(session);
    
    // Record opening movement
    await this.recordMovement(sessionId, {
      type: MovementType.OPENING,
      amount: openingAmount,
      description: 'Apertura de caja',
      userId
    });

    await logAudit('cash_session', sessionId, 'open', userId, {
      opening_amount: openingAmount
    });

    return session;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RECORD CASH MOVEMENT
  // ════════════════════════════════════════════════════════════════════════════
  
  async recordMovement(sessionId, { type, amount, description, referenceId = null, userId = null }) {
    const session = await db.cashSessions.get(sessionId);
    if (!session || session.status !== SessionStatus.OPEN) {
      throw new Error('No hay sesión de caja activa');
    }

    // Create movement record
    const movementId = `cm_${Date.now()}`;
    await db.cashMovements?.add({
      id: movementId,
      session_id: sessionId,
      type,
      amount,
      description,
      reference_id: referenceId,
      user_id: userId,
      created_at: new Date().toISOString()
    });

    // Update session running totals
    const updates = {
      transaction_count: (session.transaction_count || 0) + 1
    };

    switch (type) {
      case MovementType.SALE:
        updates.total_sales = (session.total_sales || 0) + amount;
        updates.expected_cash = (session.expected_cash || 0) + amount;
        break;
      case MovementType.REFUND:
        updates.total_refunds = (session.total_refunds || 0) + amount;
        updates.expected_cash = (session.expected_cash || 0) - amount;
        break;
      case MovementType.CASH_IN:
        updates.total_cash_in = (session.total_cash_in || 0) + amount;
        updates.expected_cash = (session.expected_cash || 0) + amount;
        break;
      case MovementType.CASH_OUT:
        updates.total_cash_out = (session.total_cash_out || 0) + amount;
        updates.expected_cash = (session.expected_cash || 0) - amount;
        break;
    }

    await db.cashSessions.update(sessionId, updates);

    return movementId;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RECORD SALE (Called from POS)
  // ════════════════════════════════════════════════════════════════════════════
  
  async recordSale(cashAmount, saleId, userId = null) {
    const session = await this.getCurrentSession();
    if (!session) {
      // If no session, still allow sale but log warning
      console.warn('Sale recorded without active cash session');
      return null;
    }

    return await this.recordMovement(session.id, {
      type: MovementType.SALE,
      amount: cashAmount,
      description: `Venta ${saleId}`,
      referenceId: saleId,
      userId
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CASH IN / CASH OUT
  // ════════════════════════════════════════════════════════════════════════════
  
  async cashIn(amount, description, userId) {
    const session = await this.getCurrentSession();
    if (!session) throw new Error('No hay caja abierta');

    return await this.recordMovement(session.id, {
      type: MovementType.CASH_IN,
      amount,
      description: description || 'Entrada de efectivo',
      userId
    });
  }

  async cashOut(amount, description, userId) {
    const session = await this.getCurrentSession();
    if (!session) throw new Error('No hay caja abierta');

    // Validate sufficient funds
    if (amount > session.expected_cash) {
      throw new Error(`Fondos insuficientes. Disponible: $${session.expected_cash.toFixed(2)}`);
    }

    return await this.recordMovement(session.id, {
      type: MovementType.CASH_OUT,
      amount,
      description: description || 'Salida de efectivo',
      userId
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BLIND CLOSE - Step 1: Start closing (hide expected amount)
  // ════════════════════════════════════════════════════════════════════════════
  
  async startBlindClose(userId) {
    const session = await this.getCurrentSession();
    if (!session) throw new Error('No hay caja abierta');

    // Mark session as closing (prevents new transactions)
    await db.cashSessions.update(session.id, {
      status: SessionStatus.CLOSING
    });

    await logAudit('cash_session', session.id, 'start_blind_close', userId);

    // Return session WITHOUT expected amount (blind!)
    return {
      id: session.id,
      opened_at: session.opened_at,
      opening_amount: session.opening_amount,
      transaction_count: session.transaction_count,
      // expected_cash is NOT returned - that's the "blind" part!
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BLIND CLOSE - Step 2: Declare counted amount
  // ════════════════════════════════════════════════════════════════════════════
  
  async submitBlindClose(sessionId, userId, declaredAmount, denominationCount = null, notes = null) {
    const session = await db.cashSessions.get(sessionId);
    if (!session) throw new Error('Sesión no encontrada');
    if (session.status === SessionStatus.CLOSED) throw new Error('La caja ya está cerrada');

    const now = new Date().toISOString();
    
    // Calculate variance (positive = overage, negative = shortage)
    const variance = declaredAmount - session.expected_cash;
    let varianceThreshold = 1;
    try {
      const thresholdSetting = await db.settings?.get("cash_variance_threshold");
      if (thresholdSetting?.value) {
        varianceThreshold = Number(thresholdSetting.value) || varianceThreshold;
      }
    } catch {}

    // Close the session
    await db.cashSessions.update(sessionId, {
      status: SessionStatus.CLOSED,
      declared_amount: declaredAmount,
      closing_denomination: denominationCount ? JSON.stringify(denominationCount) : null,
      variance,
      closed_at: now,
      closed_by: userId,
      closing_notes: notes
    });

    // Create variance record if significant
    if (Math.abs(variance) > 0.01) {
      await db.cashVariances?.add({
        id: `cv_${Date.now()}`,
        session_id: sessionId,
        expected: session.expected_cash,
        declared: declaredAmount,
        variance,
        variance_type: variance > 0 ? 'overage' : 'shortage',
        user_id: userId,
        notes,
        created_at: now
      });
    }

    if (Math.abs(variance) >= varianceThreshold) {
      sentinelService.addAlert(
        ALERT_TYPES.CASH_EVIDENCE_REQUIRED,
        'Cierre de caja con varianza requiere evidencia',
        {
          reference_type: 'cash_session',
          reference_id: sessionId,
          variance,
          evidence_required: true
        }
      );
    }

    await logAudit('cash_session', sessionId, 'close', userId, {
      expected: session.expected_cash,
      declared: declaredAmount,
      variance
    });

    // Return full closing report
    return {
      session_id: sessionId,
      opened_at: session.opened_at,
      closed_at: now,
      
      opening_amount: session.opening_amount,
      
      total_sales: session.total_sales,
      total_refunds: session.total_refunds,
      total_cash_in: session.total_cash_in,
      total_cash_out: session.total_cash_out,
      transaction_count: session.transaction_count,
      
      expected_cash: session.expected_cash,
      declared_amount: declaredAmount,
      variance,
      variance_type: variance === 0 ? 'exact' : (variance > 0 ? 'overage' : 'shortage'),
      
      is_balanced: Math.abs(variance) < 0.01
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GET SESSION SUMMARY (for display)
  // ════════════════════════════════════════════════════════════════════════════
  
  async getSessionSummary(sessionId) {
    const session = await db.cashSessions.get(sessionId);
    if (!session) return null;

    const movements = await db.cashMovements
      ?.where('session_id')
      .equals(sessionId)
      .toArray() || [];

    return {
      ...session,
      movements,
      net_change: (session.total_sales || 0) - (session.total_refunds || 0) + 
                  (session.total_cash_in || 0) - (session.total_cash_out || 0)
    };
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GET HISTORY
  // ════════════════════════════════════════════════════════════════════════════
  
  async getHistory(limit = 30) {
    return await db.cashSessions
      ?.orderBy('created_at')
      .reverse()
      .limit(limit)
      .toArray() || [];
  }

  // ════════════════════════════════════════════════════════════════════════════
  // GET VARIANCE REPORT
  // ════════════════════════════════════════════════════════════════════════════
  
  async getVarianceReport(startDate, endDate) {
    const sessions = await db.cashSessions
      ?.where('closed_at')
      .between(startDate, endDate)
      .toArray() || [];

    const totalVariance = sessions.reduce((sum, s) => sum + (s.variance || 0), 0);
    const shortages = sessions.filter(s => (s.variance || 0) < 0);
    const overages = sessions.filter(s => (s.variance || 0) > 0);

    return {
      period: { start: startDate, end: endDate },
      total_sessions: sessions.length,
      total_variance: totalVariance,
      shortage_count: shortages.length,
      shortage_total: shortages.reduce((sum, s) => sum + Math.abs(s.variance), 0),
      overage_count: overages.length,
      overage_total: overages.reduce((sum, s) => sum + s.variance, 0),
      sessions: sessions.map(s => ({
        id: s.id,
        date: s.closed_at,
        expected: s.expected_cash,
        declared: s.declared_amount,
        variance: s.variance,
        user: s.closed_by
      }))
    };
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SINGLETON EXPORT
// ══════════════════════════════════════════════════════════════════════════════

export const cashSession = new CashSessionManager();
export default cashSession;
