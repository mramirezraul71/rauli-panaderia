/**
 * GENESIS - Accounting Page
 */

import { useState, useEffect } from 'react';
import { 
  HiOutlineCurrencyDollar, HiOutlineRefresh, HiOutlineDocumentText,
  HiOutlineChartPie, HiOutlineLibrary, HiOutlineCreditCard, HiOutlineScale,
  HiOutlineChevronDown, HiOutlineChevronRight
} from 'react-icons/hi';
import { accounting } from '../services/api';
import { db, logAudit } from '../services/dataService';
import { useAuth } from '../context/AuthContext';
import accountingCore, { CHART_OF_ACCOUNTS } from '../core/AccountingCore';
import sentinelService, { ALERT_TYPES } from '../services/SentinelService';
import { formatCurrency } from '../config/businessConfig';
import { t } from "../i18n";
import { COUNTRIES, findCountryByInput, formatCountryOption, getCountryByCode } from '../config/countries';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: HiOutlineChartPie },
  { id: 'accounts', label: 'Plan de Cuentas', icon: HiOutlineLibrary },
  { id: 'entries', label: 'Asientos', icon: HiOutlineDocumentText },
  { id: 'bank', label: 'Bancos', icon: HiOutlineCreditCard },
  { id: 'reports', label: 'Reportes', icon: HiOutlineScale },
];

export default function Accounting() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [accountingStyle, setAccountingStyle] = useState('traditional');
  const [dashboard, setDashboard] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [entries, setEntries] = useState([]);
  const [accountDraft, setAccountDraft] = useState({
    code: "",
    name: "",
    type: "asset",
    nature: "debit",
    parent: ""
  });
  const [editingAccount, setEditingAccount] = useState(null);
  const [accountSearch, setAccountSearch] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("all");
  const [showInactiveAccounts, setShowInactiveAccounts] = useState(false);
  const [expandedParents, setExpandedParents] = useState(new Set());
  const [entryDraft, setEntryDraft] = useState({
    description: "",
    date: new Date().toISOString().split("T")[0]
  });
  const [entryLines, setEntryLines] = useState([
    { accountCode: "", description: "", debit: "", credit: "" },
    { accountCode: "", description: "", debit: "", credit: "" }
  ]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [bankMode, setBankMode] = useState('manual');
  const [bankCountry, setBankCountry] = useState('global');
  const [bankCountryQuery, setBankCountryQuery] = useState('');
  const [bankProvider, setBankProvider] = useState('manual');
  const [bankStatementFormat, setBankStatementFormat] = useState('csv');
  const [bankWebhookUrl, setBankWebhookUrl] = useState('');
  const [lastStatementName, setLastStatementName] = useState('');
  const [bankSyncFrequency, setBankSyncFrequency] = useState('manual');
  const [bankAutoMatch, setBankAutoMatch] = useState(true);
  const [bankMatchTolerance, setBankMatchTolerance] = useState('0.01');
  const [bankMatchWindowDays, setBankMatchWindowDays] = useState('3');
  const [bankCredits, setBankCredits] = useState([]);
  const [bankCreditDraft, setBankCreditDraft] = useState({
    name: '',
    lender: '',
    type: 'loan',
    limit: '',
    balance: '',
    rate: '',
    next_payment: ''
  });
  const [recurringPayments, setRecurringPayments] = useState([]);
  const [recurringDraft, setRecurringDraft] = useState({
    name: '',
    provider: '',
    amount: '',
    frequency: 'monthly',
    day: '1',
    next_run: '',
    expense_account: CHART_OF_ACCOUNTS.EXPENSES.OTHER_EXPENSES.code,
    bank_account: CHART_OF_ACCOUNTS.ASSETS.BANK.code
  });
  const [recurringAutoPost, setRecurringAutoPost] = useState(true);
  const [recurringLastRun, setRecurringLastRun] = useState('');
  const [lastReconcileSummary, setLastReconcileSummary] = useState([]);
  const { user } = useAuth();

  useEffect(() => { loadData(); loadBankConfig(); }, []);
  useEffect(() => {
    const loadStyle = async () => {
      try {
        const stored = await db.settings?.get('accounting_style');
        if (stored?.value) setAccountingStyle(stored.value);
      } catch {}
    };
    loadStyle();
  }, []);

  useEffect(() => {
    if (activeTab === 'accounts') loadAccounts();
    if (activeTab === 'entries') {
      loadEntries();
      if (accounts.length === 0) loadAccounts();
    }
    if (activeTab === 'bank') {
      loadBankData();
      loadEntries();
    }
    if (activeTab === 'reports') loadReports();
  }, [activeTab]);

  useEffect(() => {
    const saveStyle = async () => {
      try {
        await db.settings?.put({ key: 'accounting_style', value: accountingStyle });
      } catch {}
    };
    saveStyle();
  }, [accountingStyle]);

  useEffect(() => {
    if (activeTab === 'bank' && recurringAutoPost) {
      executeRecurringPayments();
    }
  }, [activeTab, recurringAutoPost]);

  useEffect(() => {
    if (!accounts.length || expandedParents.size) return;
    const parentCodes = new Set(accounts.filter((acc) => acc.active === 1 && acc.code).map((acc) => acc.code));
    setExpandedParents(parentCodes);
  }, [accounts, expandedParents.size]);

  useEffect(() => {
    if (bankCountry === 'global') {
      setBankCountryQuery('Internacional (GLOBAL)');
      return;
    }
    const selected = getCountryByCode(bankCountry);
    if (selected) setBankCountryQuery(formatCountryOption(selected));
  }, [bankCountry]);

  const loadBankConfig = async () => {
    try {
      const mode = await db.settings?.get('bank_integration_mode');
      const country = await db.settings?.get('bank_country_rules');
      const provider = await db.settings?.get('bank_provider');
      const format = await db.settings?.get('bank_statement_format');
      const webhook = await db.settings?.get('bank_webhook_url');
      const lastStatement = await db.settings?.get('bank_statement_name');
      const syncFrequency = await db.settings?.get('bank_sync_frequency');
      const autoMatch = await db.settings?.get('bank_auto_match');
      const matchTolerance = await db.settings?.get('bank_reconcile_tolerance');
      const matchWindow = await db.settings?.get('bank_reconcile_window');
      const creditLines = await db.settings?.get('bank_credit_lines');
      const recurring = await db.settings?.get('bank_recurring_payments');
      const recurringAuto = await db.settings?.get('bank_recurring_auto_post');
      const recurringRun = await db.settings?.get('bank_recurring_last_run');
      if (mode?.value) setBankMode(mode.value);
      if (country?.value) setBankCountry(country.value);
      if (provider?.value) setBankProvider(provider.value);
      if (format?.value) setBankStatementFormat(format.value);
      if (webhook?.value) setBankWebhookUrl(webhook.value);
      if (lastStatement?.value) setLastStatementName(lastStatement.value);
      if (syncFrequency?.value) setBankSyncFrequency(syncFrequency.value);
      if (typeof autoMatch?.value === 'boolean') setBankAutoMatch(autoMatch.value);
      if (matchTolerance?.value) setBankMatchTolerance(String(matchTolerance.value));
      if (matchWindow?.value) setBankMatchWindowDays(String(matchWindow.value));
      if (creditLines?.value) {
        try {
          const parsed = JSON.parse(creditLines.value);
          if (Array.isArray(parsed)) setBankCredits(parsed);
        } catch (parseErr) {
          console.error('Error parsing bank credit lines:', parseErr);
        }
      }
      if (recurring?.value) {
        try {
          const parsed = JSON.parse(recurring.value);
          if (Array.isArray(parsed)) setRecurringPayments(parsed);
        } catch (parseErr) {
          console.error('Error parsing recurring payments:', parseErr);
        }
      }
      if (typeof recurringAuto?.value === 'boolean') setRecurringAutoPost(recurringAuto.value);
      if (recurringRun?.value) setRecurringLastRun(recurringRun.value);
    } catch (err) {
      console.error('Error loading bank config:', err);
    }
  };

  const saveBankConfig = async () => {
    await db.settings?.put({ key: 'bank_integration_mode', value: bankMode });
    await db.settings?.put({ key: 'bank_country_rules', value: bankCountry });
    await db.settings?.put({ key: 'bank_provider', value: bankProvider });
    await db.settings?.put({ key: 'bank_statement_format', value: bankStatementFormat });
    await db.settings?.put({ key: 'bank_webhook_url', value: bankWebhookUrl });
    await db.settings?.put({ key: 'bank_sync_frequency', value: bankSyncFrequency });
    await db.settings?.put({ key: 'bank_auto_match', value: bankAutoMatch });
    await db.settings?.put({ key: 'bank_reconcile_tolerance', value: Number(bankMatchTolerance || 0) });
    await db.settings?.put({ key: 'bank_reconcile_window', value: Number(bankMatchWindowDays || 0) });
    await db.settings?.put({ key: 'bank_recurring_auto_post', value: recurringAutoPost });
  };

  const handleStatementUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLastStatementName(file.name);
    await db.settings?.put({ key: 'bank_statement_name', value: file.name });
    await db.settings?.put({ key: 'bank_statement_uploaded_at', value: new Date().toISOString() });
  };

  const saveBankCredits = async (nextCredits) => {
    setBankCredits(nextCredits);
    await db.settings?.put({ key: 'bank_credit_lines', value: JSON.stringify(nextCredits) });
  };

  const saveRecurringPayments = async (nextPayments) => {
    setRecurringPayments(nextPayments);
    await db.settings?.put({ key: 'bank_recurring_payments', value: JSON.stringify(nextPayments) });
  };

  const handleAddCredit = async () => {
    if (!bankCreditDraft.name || !bankCreditDraft.lender) return;
    const nextCredits = [
      {
        id: `cred_${Date.now()}`,
        ...bankCreditDraft,
        limit: Number(bankCreditDraft.limit || 0),
        balance: Number(bankCreditDraft.balance || 0),
        rate: Number(bankCreditDraft.rate || 0)
      },
      ...bankCredits
    ];
    await saveBankCredits(nextCredits);
    setBankCreditDraft({
      name: '',
      lender: '',
      type: 'loan',
      limit: '',
      balance: '',
      rate: '',
      next_payment: ''
    });
  };

  const handleRemoveCredit = async (creditId) => {
    const nextCredits = bankCredits.filter(item => item.id !== creditId);
    await saveBankCredits(nextCredits);
  };

  const handleAddRecurring = async () => {
    if (!recurringDraft.name || !recurringDraft.amount) return;
    const nextPayments = [
      {
        id: `rec_${Date.now()}`,
        ...recurringDraft,
        amount: Number(recurringDraft.amount || 0),
        day: Number(recurringDraft.day || 1)
      },
      ...recurringPayments
    ];
    await saveRecurringPayments(nextPayments);
    setRecurringDraft({
      name: '',
      provider: '',
      amount: '',
      frequency: 'monthly',
      day: '1',
      next_run: '',
      expense_account: CHART_OF_ACCOUNTS.EXPENSES.OTHER_EXPENSES.code,
      bank_account: CHART_OF_ACCOUNTS.ASSETS.BANK.code
    });
  };

  const handleRemoveRecurring = async (paymentId) => {
    const nextPayments = recurringPayments.filter(item => item.id !== paymentId);
    await saveRecurringPayments(nextPayments);
  };

  const getDueRecurringPayments = (today) => {
    if (!recurringPayments.length) return [];
    const todayDate = today || new Date();
    const todayKey = todayDate.toISOString().split('T')[0];
    return recurringPayments.filter((payment) => {
      if (payment.next_run) {
        return payment.next_run <= todayKey;
      }
      if (payment.frequency === 'weekly' || payment.frequency === 'biweekly') {
        return true;
      }
      const day = Number(payment.day || 1);
      return todayDate.getDate() === day;
    });
  };

  const computeNextRun = (payment, baseDate = new Date()) => {
    const next = new Date(baseDate);
    const day = Number(payment.day || 1);
    if (payment.frequency === 'weekly') {
      next.setDate(next.getDate() + 7);
    } else if (payment.frequency === 'biweekly') {
      next.setDate(next.getDate() + 14);
    } else if (payment.frequency === 'quarterly') {
      const targetMonth = next.getMonth() + 3;
      next.setMonth(targetMonth, 1);
      const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, daysInMonth));
    } else {
      const targetMonth = next.getMonth() + 1;
      next.setMonth(targetMonth, 1);
      const daysInMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(day, daysInMonth));
    }
    return next.toISOString().split('T')[0];
  };

  const executeRecurringPayments = async ({ manual = false } = {}) => {
    if (!manual && !recurringAutoPost) return;
    if (!manual && recurringLastRun && isSameDay(recurringLastRun, new Date())) return;
    const due = getDueRecurringPayments(new Date());
    if (!due.length) return;
    await accountingCore.initialize();
    const nextPayments = [...recurringPayments];
    const nowIso = new Date().toISOString();
    for (const payment of due) {
      try {
        const expenseAccount = payment.expense_account || CHART_OF_ACCOUNTS.EXPENSES.OTHER_EXPENSES.code;
        const bankAccount = payment.bank_account || CHART_OF_ACCOUNTS.ASSETS.BANK.code;
        await accountingCore.createJournalEntry({
          description: `Pago recurrente: ${payment.name}`,
          reference: payment.provider || payment.name,
          type: 'recurring_payment',
          lines: [
            { accountCode: expenseAccount, debit: Number(payment.amount || 0), description: payment.name },
            { accountCode: bankAccount, credit: Number(payment.amount || 0), description: payment.name }
          ],
          date: nowIso
        });
        const idx = nextPayments.findIndex((item) => item.id === payment.id);
        if (idx >= 0) {
          nextPayments[idx] = {
            ...nextPayments[idx],
            next_run: computeNextRun(payment, new Date())
          };
        }
      } catch (error) {
        sentinelService.addAlert(
          ALERT_TYPES.BANK_PAYMENT_FAILED,
          'Pago recurrente fallido',
          {
            paymentId: payment.id,
            name: payment.name,
            reason: error?.message || 'Error desconocido'
          }
        );
      }
    }
    await saveRecurringPayments(nextPayments);
    await db.settings?.put({ key: 'bank_recurring_last_run', value: nowIso });
    setRecurringLastRun(nowIso);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await accounting.dashboard();
      setDashboard(res.data.dashboard);
    } catch (err) {
      console.error('Error loading accounting data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAccounts = async () => {
    try {
      const res = await accounting.accounts();
      const apiAccounts = res.data.accounts || [];
      if (apiAccounts.length) {
        setAccounts(apiAccounts);
        return;
      }
      await accountingCore.initialize();
      const localAccounts = await db.accounts?.toArray() || [];
      setAccounts(localAccounts);
    } catch (err) { console.error('Error loading accounts:', err); }
  };

  const loadEntries = async () => {
    try {
      const res = await accounting.entries({ limit: 50 });
      const apiEntries = res.data.entries || [];
      if (apiEntries.length) {
        setEntries(apiEntries);
        return;
      }
      await accountingCore.initialize();
      const localEntries = await db.journalEntries?.toArray() || [];
      const accountMap = new Map((await db.accounts?.toArray() || []).map((acc) => [acc.code, acc.name]));
      const withLines = await Promise.all(localEntries.map(async (entry) => {
        const lines = await db.journalLines?.where("entry_id").equals(entry.id).toArray() || [];
        return {
          ...entry,
          lines: lines.map((line) => ({
            account_code: line.account_code,
            account_name: accountMap.get(line.account_code) || line.account_code,
            debit: line.debit,
            credit: line.credit
          }))
        };
      }));
      setEntries(withLines);
    } catch (err) { console.error('Error loading entries:', err); }
  };

  const loadBankData = async () => {
    try {
      const [accRes, transRes] = await Promise.all([
        accounting.bankAccounts(),
        accounting.bankTransactions({ limit: 50 })
      ]);
      setBankAccounts(accRes.data.accounts || []);
      setBankTransactions(transRes.data.transactions || []);
    } catch (err) { console.error('Error loading bank data:', err); }
  };

  const loadReports = async () => {
    try {
      const [balRes, incRes] = await Promise.all([
        accounting.balanceSheet({}),
        accounting.incomeStatement({})
      ]);
      setBalanceSheet(balRes.data.balance);
      setIncomeStatement(balRes.data.income_statement || incRes.data.income_statement);
    } catch (err) { console.error('Error loading reports:', err); }
  };

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const exportCSV = (rows, filename) => {
    if (!rows?.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(','),
      ...rows.map((row) => headers.map((key) => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveAccount = async () => {
    if (!accountDraft.code || !accountDraft.name) {
      toast.error("Completa código y nombre");
      return;
    }
    const normalizedType = normalizeType(accountDraft.type);
    const confirmText = [
      editingAccount ? "Vas a actualizar una cuenta contable." : "Vas a crear una cuenta contable.",
      `Código: ${accountDraft.code}`,
      `Nombre: ${accountDraft.name}`,
      `Tipo: ${getAccountTypeLabel(normalizedType)}`,
      `Naturaleza: ${accountDraft.nature === "debit" ? "Debe" : "Haber"}`,
      accountDraft.parent ? `Cuenta padre: ${accountDraft.parent}` : "Cuenta padre: (ninguna)",
      "¿Todo correcto?"
    ].join("\n");
    if (!confirm(confirmText)) {
      toast.error("Acción cancelada");
      return;
    }
    const payload = {
      id: accountDraft.code,
      code: accountDraft.code,
      name: accountDraft.name,
      type: normalizedType,
      nature: accountDraft.nature,
      category: normalizedType,
      parent: accountDraft.parent || null,
      balance: 0,
      active: 1,
      system: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await db.accounts?.put(payload);
    toast.success("Cuenta guardada");
    setAccountDraft({ code: "", name: "", type: "asset", nature: "debit", parent: "" });
    setEditingAccount(null);
    loadAccounts();
  };

  const handleEditAccount = (account) => {
    setEditingAccount(account.code);
    setAccountDraft({
      code: account.code,
      name: account.name,
      type: normalizeType(account.type),
      nature: account.nature,
      parent: account.parent || ""
    });
  };

  const handleDeactivateAccount = async (account) => {
    if (account.system === 1) {
      toast.error("No se pueden desactivar cuentas del sistema");
      return;
    }
    if (!confirm(`Desactivar cuenta ${account.code} - ${account.name}?`)) return;
    await db.accounts?.update(account.id, { active: 0, updated_at: new Date().toISOString() });
    toast.success("Cuenta desactivada");
    loadAccounts();
  };

  const handleActivateAccount = async (account) => {
    if (!confirm(`Activar cuenta ${account.code} - ${account.name}?`)) return;
    await db.accounts?.update(account.id, { active: 1, updated_at: new Date().toISOString() });
    toast.success("Cuenta activada");
    loadAccounts();
  };

  const handleAddEntryLine = () => {
    setEntryLines((prev) => [...prev, { accountCode: "", description: "", debit: "", credit: "" }]);
  };

  const handleUpdateEntryLine = (index, changes) => {
    setEntryLines((prev) => prev.map((line, idx) => (
      idx === index ? { ...line, ...changes } : line
    )));
  };

  const handleRemoveEntryLine = (index) => {
    setEntryLines((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveEntry = async () => {
    const cleanedLines = entryLines
      .map((line) => ({
        accountCode: line.accountCode,
        description: line.description,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0)
      }))
      .filter((line) => line.accountCode && (line.debit > 0 || line.credit > 0));

    if (!entryDraft.description || cleanedLines.length < 2) {
      toast.error("Agrega una descripción y al menos 2 líneas");
      return;
    }
    const totalDebit = cleanedLines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const totalCredit = cleanedLines.reduce((sum, l) => sum + (l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      toast.error("El asiento está descuadrado (Debe ≠ Haber)");
      return;
    }
    const linesPreview = cleanedLines
      .map((line) => `${line.accountCode} · ${line.description || "Detalle"} | Debe: ${line.debit} / Haber: ${line.credit}`)
      .join("\n");
    const confirmText = [
      "Vas a registrar un asiento contable manual.",
      `Descripción: ${entryDraft.description}`,
      `Fecha: ${entryDraft.date}`,
      `Debe: ${totalDebit} | Haber: ${totalCredit}`,
      "Detalle:",
      linesPreview,
      "¿Todo correcto?"
    ].join("\n");
    if (!confirm(confirmText)) {
      toast.error("Acción cancelada");
      return;
    }
    try {
      await accountingCore.createJournalEntry({
        description: entryDraft.description,
        reference: "MANUAL",
        type: "manual",
        date: entryDraft.date,
        lines: cleanedLines
      });
      toast.success("Asiento registrado");
      setEntryDraft({ description: "", date: new Date().toISOString().split("T")[0] });
      setEntryLines([
        { accountCode: "", description: "", debit: "", credit: "" },
        { accountCode: "", description: "", debit: "", credit: "" }
      ]);
      loadEntries();
      loadAccounts();
    } catch (e) {
      toast.error(e.message || "Error guardando asiento");
    }
  };

  const handleVoidEntry = async (entry) => {
    if (!entry?.id) return;
    const reason = prompt("Motivo de anulación");
    if (!reason) return;
    try {
      await accountingCore.voidJournalEntry(entry.id, reason);
      toast.success("Asiento anulado");
      loadEntries();
      loadAccounts();
    } catch (e) {
      toast.error(e.message || "No se pudo anular el asiento");
    }
  };

  const buildAccountTree = (list, options = {}) => {
    const { search = "", typeFilter = "all", showInactive = false, expanded = new Set() } = options;
    const trimmed = String(search || "").toLowerCase();
    const base = showInactive ? (list || []) : (list || []).filter((acc) => acc.active === 1);
    const byCode = new Map(base.map((acc) => [acc.code, acc]));
    const childrenMap = new Map();
    base.forEach((acc) => {
      const parent = acc.parent || null;
      if (!childrenMap.has(parent)) childrenMap.set(parent, []);
      childrenMap.get(parent).push(acc);
    });
    childrenMap.forEach((nodes) => nodes.sort((a, b) => a.code.localeCompare(b.code)));
    const rows = [];
    const parentCodes = new Set();
    childrenMap.forEach((nodes, parent) => {
      if (parent && nodes.length) parentCodes.add(parent);
    });
    const typeActive = typeFilter && typeFilter !== "all";
    const filterActive = Boolean(trimmed) || typeActive;
    const includeCodes = new Set();
    if (filterActive) {
      base.forEach((acc) => {
        const typeOk = !typeActive || normalizeType(acc.type) === typeFilter;
        const searchOk = !trimmed || `${acc.code} ${acc.name}`.toLowerCase().includes(trimmed);
        if (typeOk && searchOk) {
          includeCodes.add(acc.code);
          let parent = acc.parent;
          while (parent) {
            includeCodes.add(parent);
            parent = byCode.get(parent)?.parent || null;
          }
        }
      });
    }
    const walk = (parent, depth) => {
      const nodes = childrenMap.get(parent) || [];
      nodes.forEach((node) => {
        if (filterActive && !includeCodes.has(node.code)) return;
        rows.push({
          ...node,
          depth,
          hasChildren: (childrenMap.get(node.code) || []).length > 0
        });
        if (!expanded.has(node.code) && (childrenMap.get(node.code) || []).length > 0) return;
        walk(node.code, depth + 1);
      });
    };
    walk(null, 0);
    return { rows, byCode, parentCodes };
  };
  const getDayDiff = (dateA, dateB) => {
    if (!dateA || !dateB) return Number.POSITIVE_INFINITY;
    const a = new Date(dateA).setHours(0, 0, 0, 0);
    const b = new Date(dateB).setHours(0, 0, 0, 0);
    return Math.abs(a - b) / (1000 * 60 * 60 * 24);
  };

  const isSameDay = (dateA, dateB) => {
    if (!dateA || !dateB) return false;
    const a = new Date(dateA).toISOString().split('T')[0];
    const b = new Date(dateB).toISOString().split('T')[0];
    return a === b;
  };

  const getDaysUntil = (date) => {
    if (!date) return Number.POSITIVE_INFINITY;
    const today = new Date().setHours(0, 0, 0, 0);
    const target = new Date(date).setHours(0, 0, 0, 0);
    return Math.round((target - today) / (1000 * 60 * 60 * 24));
  };

  const getSuggestedMatches = () => {
    if (!bankTransactions.length || !entries.length) return [];
    const availableEntries = entries.filter((entry) => entry?.total_amount != null);
    const tolerance = Number(bankMatchTolerance || 0);
    const windowDays = Number(bankMatchWindowDays || 0);
    return bankTransactions
      .filter((tx) => !tx.reconciled)
      .map((tx) => {
        const txAmount = Math.abs(Number(tx.amount || 0));
        const candidates = availableEntries
          .map((entry) => {
            const entryAmount = Math.abs(Number(entry.total_amount || 0));
            const amountDiff = Math.abs(entryAmount - txAmount);
            const dayDiff = getDayDiff(tx.date, entry.date);
            return { entry, amountDiff, dayDiff };
          })
          .filter((item) => item.amountDiff <= tolerance && item.dayDiff <= windowDays)
          .sort((a, b) => (a.dayDiff - b.dayDiff) || (a.amountDiff - b.amountDiff));
        return candidates.length ? { tx, match: candidates[0].entry } : null;
      })
      .filter(Boolean);
  };

  const reconcileTransaction = (transactionId) => {
    setBankTransactions((prev) =>
      prev.map((tx) => (tx.id === transactionId ? { ...tx, reconciled: true } : tx))
    );
  };

  const reconcileAllSuggested = (suggested) => {
    if (!suggested?.length) return;
    const ids = new Set(suggested.map((item) => item.tx.id));
    const batchTimestamp = new Date().toISOString();
    const batchUser = user?.id || 'sin_usuario';
    const batchRole = user?.role || 'sin_rol';
    setBankTransactions((prev) =>
      prev.map((tx) => (ids.has(tx.id) ? { ...tx, reconciled: true } : tx))
    );
    const summaryRows = suggested.map((item) => ({
      usuario: batchUser,
      rol: batchRole,
      fecha_lote: batchTimestamp,
      fecha_banco: item.tx.date,
      descripcion_banco: item.tx.description || '',
      monto_banco: item.tx.amount,
      asiento: item.match.entry_number || '',
      fecha_asiento: item.match.date || '',
      descripcion_asiento: item.match.description || '',
      monto_asiento: item.match.total_amount || ''
    }));
    setLastReconcileSummary(summaryRows);
    try {
      logAudit({
        entity: 'bank',
        entity_id: 'bulk_reconcile',
        action: 'bulk_reconcile',
        user_id: user?.id,
        details: {
          count: suggested.length,
          transaction_ids: Array.from(ids)
        }
      });
    } catch (error) {
      console.error('Error logging bulk reconcile audit:', error);
    }
  };

  const getBankAlerts = () => {
    const alerts = [];
    bankAccounts.forEach((acc) => {
      if ((acc.balance || 0) < 0) {
        alerts.push({
          id: `overdraft_${acc.id}`,
          level: 'alta',
          title: 'Sobregiro detectado',
          detail: `${acc.name} (${formatCurrency(acc.balance)})`
        });
      }
      if ((acc.pending_count || 0) > 0) {
        alerts.push({
          id: `pending_${acc.id}`,
          level: 'media',
          title: 'Conciliacion pendiente',
          detail: `${acc.pending_count} movimientos por conciliar`
        });
      }
    });
    bankCredits.forEach((credit) => {
      const limit = Number(credit.limit || 0);
      const balance = Number(credit.balance || 0);
      const utilization = limit > 0 ? balance / limit : 0;
      if (utilization >= 0.8) {
        alerts.push({
          id: `util_${credit.id}`,
          level: utilization >= 0.95 ? 'alta' : 'media',
          title: 'Uso de credito elevado',
          detail: `${credit.name} (${Math.round(utilization * 100)}%)`
        });
      }
      if (credit.next_payment) {
        const daysToPay = getDaysUntil(credit.next_payment);
        if (daysToPay < 0 && balance > 0) {
          alerts.push({
            id: `overdue_${credit.id}`,
            level: 'alta',
            title: 'Pago en mora',
            detail: `${credit.name} vencio ${formatDate(credit.next_payment)}`
          });
        } else if (daysToPay <= 7 && balance > 0) {
          alerts.push({
            id: `due_${credit.id}`,
            level: daysToPay <= 2 ? 'alta' : 'media',
            title: 'Pago proximo',
            detail: `${credit.name} vence ${formatDate(credit.next_payment)}`
          });
        }
      }
    });
    recurringPayments.forEach((payment) => {
      if (!payment.next_run) return;
      const daysToRun = getDaysUntil(payment.next_run);
      if (daysToRun < 0) {
        alerts.push({
          id: `rec_overdue_${payment.id}`,
          level: 'alta',
          title: 'Pago recurrente en mora',
          detail: `${payment.name} debio pagarse ${formatDate(payment.next_run)}`
        });
      }
    });
    return alerts;
  };

  const normalizeType = (type) => {
    const map = {
      activo: "asset",
      pasivo: "liability",
      patrimonio: "equity",
      ingreso: "revenue",
      gasto: "expense",
      costo: "cost"
    };
    return map[type] || type;
  };

  const getAccountTypeLabel = (type) => {
    const normalized = normalizeType(type);
    const types = {
      asset: 'Activo',
      liability: 'Pasivo',
      equity: 'Patrimonio',
      revenue: 'Ingreso',
      cost: 'Costo',
      expense: 'Gasto'
    };
    return types[normalized] || type;
  };

  const getAccountTypeColor = (type) => {
    const normalized = normalizeType(type);
    const colors = {
      asset: 'bg-blue-500/20 text-blue-400',
      liability: 'bg-red-500/20 text-red-400',
      equity: 'bg-purple-500/20 text-purple-400',
      revenue: 'bg-green-500/20 text-green-400',
      cost: 'bg-orange-500/20 text-orange-400',
      expense: 'bg-yellow-500/20 text-yellow-400',
    };
    return colors[normalized] || 'bg-slate-500/20 text-slate-400';
  };

  // ==================== TAB COMPONENTS ====================
  const DashboardTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Ventas del Mes" value={formatCurrency(dashboard?.monthly_sales)} icon={HiOutlineCurrencyDollar} color="green" />
        <StatCard title="Por Conciliar" value={dashboard?.pending_reconciliation?.count || 0} icon={HiOutlineCreditCard} color="yellow" />
        <StatCard title="Monto Pendiente" value={formatCurrency(dashboard?.pending_reconciliation?.total)} icon={HiOutlineScale} color="red" />
        <StatCard title="Últimos Asientos" value={dashboard?.recent_entries?.length || 0} icon={HiOutlineDocumentText} color="blue" />
      </div>

      {/* Account Balances by Type */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <h3 className="font-semibold text-white mb-4">Balance por Tipo de Cuenta</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {(dashboard?.account_balances || []).map(ab => (
            <div key={ab.type} className="text-center">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mb-2 ${getAccountTypeColor(ab.type)}`}>
                {getAccountTypeLabel(ab.type)}
              </span>
              <p className="text-xl font-bold text-white">{formatCurrency(ab.total)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Entries */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
        <h3 className="font-semibold text-white mb-4">Asientos Recientes</h3>
        <div className="space-y-2">
          {(dashboard?.recent_entries || []).map(entry => (
            <div key={entry.id} className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
              <div>
                <span className="text-white font-medium">#{entry.entry_number}</span>
                <span className="text-slate-400 ml-3">{entry.description}</span>
              </div>
              <div className="text-right">
                <span className="text-green-400 font-medium">{formatCurrency(entry.total_amount)}</span>
                <span className="text-slate-500 ml-3 text-sm">{formatDate(entry.date)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const AccountsTab = () => {
    const treeData = buildAccountTree(accounts, {
      search: accountSearch,
      typeFilter: accountTypeFilter,
      showInactive: showInactiveAccounts,
      expanded: expandedParents
    });
    const toggleExpand = (code) => {
      setExpandedParents((prev) => {
        const next = new Set(prev);
        if (next.has(code)) next.delete(code);
        else next.add(code);
        return next;
      });
    };
    return (
    <div className="space-y-4">
      <p className="text-slate-400">Plan de cuentas contables</p>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={accountSearch}
            onChange={(e) => setAccountSearch(e.target.value)}
            placeholder="Buscar por código o nombre"
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm md:col-span-2"
          />
          <select
            value={accountTypeFilter}
            onChange={(e) => setAccountTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="all">Todos los tipos</option>
            <option value="asset">Activo</option>
            <option value="liability">Pasivo</option>
            <option value="equity">Patrimonio</option>
            <option value="revenue">Ingreso</option>
            <option value="cost">Costo</option>
            <option value="expense">Gasto</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={showInactiveAccounts}
              onChange={(e) => setShowInactiveAccounts(e.target.checked)}
            />
            Mostrar inactivas
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setExpandedParents(new Set(treeData.parentCodes))}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg"
          >
            Expandir todo
          </button>
          <button
            onClick={() => setExpandedParents(new Set())}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg"
          >
            Colapsar todo
          </button>
        </div>
      </div>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={async () => {
              await accountingCore.initialize();
              loadAccounts();
              toast.success("Plan de cuentas cargado");
            }}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg"
          >
            Cargar plan base
          </button>
          <button
            onClick={() => {
              setAccountDraft({ code: "", name: "", type: "asset", nature: "debit", parent: "" });
              setEditingAccount(null);
            }}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg"
          >
            Limpiar
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={accountDraft.code}
            onChange={(e) => setAccountDraft((prev) => ({ ...prev, code: e.target.value }))}
            placeholder="Código (ej: 1100)"
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
            disabled={Boolean(editingAccount)}
          />
          <input
            type="text"
            value={accountDraft.name}
            onChange={(e) => setAccountDraft((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Nombre de la cuenta"
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
          />
          <select
            value={accountDraft.type}
            onChange={(e) => setAccountDraft((prev) => ({ ...prev, type: e.target.value }))}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="asset">Activo</option>
            <option value="liability">Pasivo</option>
            <option value="equity">Patrimonio</option>
            <option value="revenue">Ingreso</option>
            <option value="cost">Costo</option>
            <option value="expense">Gasto</option>
          </select>
          <select
            value={accountDraft.nature}
            onChange={(e) => setAccountDraft((prev) => ({ ...prev, nature: e.target.value }))}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="debit">Debe (débit)</option>
            <option value="credit">Haber (crédito)</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <select
            value={accountDraft.parent}
            onChange={(e) => setAccountDraft((prev) => ({ ...prev, parent: e.target.value }))}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="">Cuenta padre (opcional)</option>
            {accounts.filter((acc) => acc.active === 1).map((acc) => (
              <option key={acc.code} value={acc.code}>{acc.code} · {acc.name}</option>
            ))}
          </select>
          <div className="text-xs text-slate-400 flex items-center">
            Usa cuenta padre para crear subcuentas (estructura jerárquica).
          </div>
        </div>
        <button
          onClick={handleSaveAccount}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg"
        >
          {editingAccount ? "Actualizar cuenta" : "Guardar cuenta"}
        </button>
      </div>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-700/50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Código</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Nombre</th>
              <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Tipo</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Balance</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {treeData.rows.map(acc => (
              <tr key={acc.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                <td className="px-4 py-3 text-indigo-400 font-mono">{acc.code}</td>
                <td className="px-4 py-3 text-white">
                  <div className="flex items-center gap-2" style={{ paddingLeft: `${acc.depth * 14}px` }}>
                    {acc.hasChildren && (
                      <button
                        onClick={() => toggleExpand(acc.code)}
                        className="text-slate-400 hover:text-white"
                        title={expandedParents.has(acc.code) ? "Colapsar" : "Expandir"}
                      >
                        {expandedParents.has(acc.code) ? <HiOutlineChevronDown className="w-4 h-4" /> : <HiOutlineChevronRight className="w-4 h-4" />}
                      </button>
                    )}
                    {!acc.hasChildren && <span className="w-4 h-4" />}
                    <span>{acc.name}</span>
                    {acc.hasChildren && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/60">
                        Padre
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAccountTypeColor(acc.type)}`}>
                    {getAccountTypeLabel(acc.type)}
                  </span>
                </td>
                <td className={`px-4 py-3 text-right font-medium ${acc.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(acc.balance)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleEditAccount(acc)}
                      className="px-2 py-1 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded"
                    >
                      Editar
                    </button>
                    {acc.active === 1 ? (
                      <button
                        onClick={() => handleDeactivateAccount(acc)}
                        className="px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded"
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivateAccount(acc)}
                        className="px-2 py-1 text-xs bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-300 rounded"
                      >
                        Activar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {treeData.rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No hay cuentas registradas o no coinciden con el filtro
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
  };

  const EntriesTab = () => (
    <div className="space-y-4">
      <p className="text-slate-400">Asientos contables (Libro Diario)</p>
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input
            type="text"
            value={entryDraft.description}
            onChange={(e) => setEntryDraft((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Descripción del asiento"
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
          />
          <input
            type="date"
            value={entryDraft.date}
            onChange={(e) => setEntryDraft((prev) => ({ ...prev, date: e.target.value }))}
            className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
          />
        </div>
        <div className="space-y-2">
          {entryLines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2">
              <select
                value={line.accountCode}
                onChange={(e) => handleUpdateEntryLine(idx, { accountCode: e.target.value })}
                className="md:col-span-4 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
              >
                <option value="">Cuenta</option>
                {accounts.map((acc) => (
                  <option key={acc.code} value={acc.code}>{acc.code} · {acc.name}</option>
                ))}
              </select>
              <input
                type="text"
                value={line.description}
                onChange={(e) => handleUpdateEntryLine(idx, { description: e.target.value })}
                placeholder="Detalle"
                className="md:col-span-4 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
              />
              <input
                type="number"
                value={line.debit}
                onChange={(e) => handleUpdateEntryLine(idx, { debit: e.target.value })}
                placeholder="Debe"
                className="md:col-span-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
              />
              <input
                type="number"
                value={line.credit}
                onChange={(e) => handleUpdateEntryLine(idx, { credit: e.target.value })}
                placeholder="Haber"
                className="md:col-span-2 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm"
              />
              <div className="md:col-span-12 flex justify-end">
                {entryLines.length > 2 && (
                  <button
                    onClick={() => handleRemoveEntryLine(idx)}
                    className="px-3 py-1 text-xs text-red-300 hover:text-red-200"
                  >
                    Quitar línea
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAddEntryLine}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg"
          >
            + Agregar línea
          </button>
          <button
            onClick={handleSaveEntry}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg"
          >
            Guardar asiento
          </button>
        </div>
      </div>
      <div className="space-y-4">
        {entries.map(entry => (
          <div key={entry.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="bg-slate-700/50 px-4 py-3 flex justify-between items-center">
              <div>
                <span className="text-indigo-400 font-mono font-bold">#{entry.entry_number}</span>
                <span className="text-white ml-3">{entry.description}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 text-sm">{formatDate(entry.date)}</span>
                <span className={`ml-3 px-2 py-1 rounded text-xs ${entry.status === 'posted' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                  {entry.status}
                </span>
                <button
                  onClick={() => handleVoidEntry(entry)}
                  className="ml-3 px-2 py-1 text-xs bg-red-900/40 hover:bg-red-900/60 text-red-300 rounded"
                >
                  Anular
                </button>
              </div>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="px-4 py-2 text-left text-xs text-slate-500">Cuenta</th>
                  <th className="px-4 py-2 text-right text-xs text-slate-500">Debe</th>
                  <th className="px-4 py-2 text-right text-xs text-slate-500">Haber</th>
                </tr>
              </thead>
              <tbody>
                {(entry.lines || []).map((line, idx) => (
                  <tr key={idx} className="border-b border-slate-700/30 last:border-0">
                    <td className="px-4 py-2">
                      <span className="text-slate-500 font-mono text-sm">{line.account_code}</span>
                      <span className="text-white ml-2">{line.account_name}</span>
                    </td>
                    <td className="px-4 py-2 text-right text-green-400">{line.debit > 0 ? formatCurrency(line.debit) : ''}</td>
                    <td className="px-4 py-2 text-right text-red-400">{line.credit > 0 ? formatCurrency(line.credit) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {entries.length === 0 && (
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
            <HiOutlineDocumentText className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">No hay asientos registrados</p>
          </div>
        )}
      </div>
    </div>
  );

  const BankTab = () => {
    const canManageBank = ['admin', 'gerente'].includes(user?.role);
    const suggestedMatches = getSuggestedMatches();
    const bankAlerts = getBankAlerts();
    return (
      <div className="space-y-6">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Integracion bancaria</h3>
              <p className="text-xs text-slate-400">Automatica o manual según pais, reglas y permisos.</p>
            </div>
            {!canManageBank && (
              <span className="text-xs text-amber-300">Requiere rol admin/gerente</span>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Modo de enlace</label>
              <select
                value={bankMode}
                onChange={(e) => setBankMode(e.target.value)}
                disabled={!canManageBank}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="manual">Manual (estado de cuenta)</option>
                <option value="automated">Automatizado</option>
                <option value="hybrid">Hibrido</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Pais / regla bancaria</label>
              <input
                value={bankCountryQuery}
                onChange={(e) => {
                  const value = e.target.value;
                  setBankCountryQuery(value);
                  if (value.toUpperCase().includes('GLOBAL') || value.toLowerCase() === 'internacional') {
                    setBankCountry('global');
                    return;
                  }
                  const next = findCountryByInput(value);
                  if (next) setBankCountry(next.id.toLowerCase());
                }}
                onFocus={() => {
                  if (bankCountry === "global" && bankCountryQuery === "Internacional (GLOBAL)") {
                    setBankCountryQuery("");
                    return;
                  }
                  const selected = getCountryByCode(bankCountry);
                  if (selected && bankCountryQuery === formatCountryOption(selected)) {
                    setBankCountryQuery("");
                  }
                }}
                onBlur={() => {
                  if (!bankCountryQuery.trim()) {
                    if (bankCountry === "global") {
                      setBankCountryQuery("Internacional (GLOBAL)");
                      return;
                    }
                    const selected = getCountryByCode(bankCountry);
                    if (selected) setBankCountryQuery(formatCountryOption(selected));
                  }
                }}
                list="bank-country-options"
                disabled={!canManageBank}
                placeholder="Buscar país"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
              />
              <datalist id="bank-country-options">
                <option value="Internacional (GLOBAL)" />
                {COUNTRIES.map((c) => (
                  <option key={c.id} value={formatCountryOption(c)} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Proveedor automatizado</label>
              <select
                value={bankProvider}
                onChange={(e) => setBankProvider(e.target.value)}
                disabled={!canManageBank}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="manual">Sin proveedor</option>
                <option value="plaid">Plaid</option>
                <option value="belvo">Belvo</option>
                <option value="truelayer">TrueLayer</option>
                <option value="yodlee">Yodlee</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Formato de estado</label>
              <select
                value={bankStatementFormat}
                onChange={(e) => setBankStatementFormat(e.target.value)}
                disabled={!canManageBank}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="csv">CSV</option>
                <option value="ofx">OFX</option>
                <option value="qif">QIF</option>
                <option value="pdf">PDF</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Webhook / API bancaria</label>
            <input
              value={bankWebhookUrl}
              onChange={(e) => setBankWebhookUrl(e.target.value)}
              disabled={!canManageBank}
              placeholder="https://api.banco.com/webhook"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="file"
              accept=".csv,.ofx,.qif,.pdf"
              onChange={handleStatementUpload}
              disabled={!canManageBank || bankMode === 'automated'}
              className="text-xs text-slate-400"
            />
            {lastStatementName && (
              <span className="text-xs text-slate-400">Ultimo estado: {lastStatementName}</span>
            )}
            <button
              onClick={saveBankConfig}
              disabled={!canManageBank}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs disabled:opacity-50"
            >
              Guardar configuracion
            </button>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-white">Actividad bancaria</h3>
            <p className="text-xs text-slate-400">Control de sincronizacion, alertas y conciliacion.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Frecuencia de sincronizacion</label>
              <select
                value={bankSyncFrequency}
                onChange={(e) => setBankSyncFrequency(e.target.value)}
                disabled={!canManageBank}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
              >
                <option value="manual">Manual</option>
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Conciliacion automatica</label>
              <button
                onClick={() => setBankAutoMatch((prev) => !prev)}
                disabled={!canManageBank}
                className={`w-full px-3 py-2 rounded-lg text-xs border ${bankAutoMatch ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
              >
                {bankAutoMatch ? 'Activa' : 'Desactivada'}
              </button>
            </div>
            <div className="bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2">
              <p className="text-xs text-slate-400">Pendientes de conciliar</p>
              <p className="text-lg text-white font-semibold">{dashboard?.pending_reconciliation?.count || 0}</p>
              <p className="text-xs text-slate-500">{formatCurrency(dashboard?.pending_reconciliation?.total || 0)}</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Tolerancia de conciliacion</label>
              <input
                value={bankMatchTolerance}
                onChange={(e) => setBankMatchTolerance(e.target.value)}
                disabled={!canManageBank}
                type="number"
                step="0.01"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Ventana de dias</label>
              <input
                value={bankMatchWindowDays}
                onChange={(e) => setBankMatchWindowDays(e.target.value)}
                disabled={!canManageBank}
                type="number"
                min="0"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-xs text-slate-400">
              Modo actual: <span className="text-slate-200">{bankMode === 'automated' ? 'Automatizado' : bankMode === 'hybrid' ? 'Hibrido' : 'Manual'}</span>
            </span>
            <span className="text-xs text-slate-400">
              Regla pais: <span className="text-slate-200">{bankCountry.toUpperCase()}</span>
            </span>
            <span className="text-xs text-slate-400">
              Proveedor: <span className="text-slate-200">{bankProvider}</span>
            </span>
            <button
              onClick={saveBankConfig}
              disabled={!canManageBank}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs disabled:opacity-50"
            >
              Guardar actividad
            </button>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Alertas bancarias</h3>
              <p className="text-xs text-slate-400">Sobregiros, mora y riesgos operativos.</p>
            </div>
            {bankAlerts.length > 0 && (
              <span className="text-xs text-amber-300">{bankAlerts.length} alerta(s)</span>
            )}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {bankAlerts.map((alert) => (
              <div key={alert.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm">{alert.title}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${alert.level === 'alta' ? 'bg-red-500/20 text-red-300' : alert.level === 'media' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                    {alert.level}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-2">{alert.detail}</p>
              </div>
            ))}
            {bankAlerts.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-4">
                Sin alertas bancarias activas
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">Conciliacion asistida</h3>
              <p className="text-xs text-slate-400">Sugerencias por monto y fecha.</p>
            </div>
            {!canManageBank && (
              <span className="text-xs text-amber-300">Requiere rol admin/gerente</span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={() => reconcileAllSuggested(suggestedMatches)}
              disabled={!canManageBank || suggestedMatches.length === 0}
              className="px-3 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg text-xs disabled:opacity-50"
            >
              Conciliar todo
            </button>
            <button
              onClick={() => exportCSV(lastReconcileSummary, 'conciliacion_masiva.csv')}
              disabled={lastReconcileSummary.length === 0}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs disabled:opacity-50"
            >
              Exportar resumen
            </button>
            <span className="text-xs text-slate-400">
              {suggestedMatches.length} sugerencia(s) con tolerancia {bankMatchTolerance} y ventana {bankMatchWindowDays} dias
            </span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {suggestedMatches.map((item) => (
              <div key={item.tx.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white text-sm">Banco: {item.tx.description || 'Movimiento'}</p>
                    <p className="text-xs text-slate-400">{formatDate(item.tx.date)} · {formatCurrency(item.tx.amount)}</p>
                  </div>
                  <button
                    onClick={() => reconcileTransaction(item.tx.id)}
                    disabled={!canManageBank}
                    className="text-xs px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 disabled:opacity-50"
                  >
                    Conciliar
                  </button>
                </div>
                <div className="mt-2 text-xs text-slate-300">
                  Sugerencia: #{item.match.entry_number} · {item.match.description}
                </div>
                <div className="text-xs text-slate-400">
                  {formatDate(item.match.date)} · {formatCurrency(item.match.total_amount)}
                </div>
              </div>
            ))}
            {suggestedMatches.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-4">
                No hay sugerencias de conciliacion
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-white">Creditos y lineas bancarias</h3>
            <p className="text-xs text-slate-400">Prestamos, tarjetas y lineas de credito.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={bankCreditDraft.name}
              onChange={(e) => setBankCreditDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre / referencia"
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <input
              value={bankCreditDraft.lender}
              onChange={(e) => setBankCreditDraft((prev) => ({ ...prev, lender: e.target.value }))}
              placeholder="Banco / entidad"
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <select
              value={bankCreditDraft.type}
              onChange={(e) => setBankCreditDraft((prev) => ({ ...prev, type: e.target.value }))}
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="loan">Prestamo</option>
              <option value="line">Linea de credito</option>
              <option value="card">Tarjeta de credito</option>
            </select>
            <input
              value={bankCreditDraft.limit}
              onChange={(e) => setBankCreditDraft((prev) => ({ ...prev, limit: e.target.value }))}
              placeholder="Cupo / limite"
              type="number"
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <input
              value={bankCreditDraft.balance}
              onChange={(e) => setBankCreditDraft((prev) => ({ ...prev, balance: e.target.value }))}
              placeholder="Saldo actual"
              type="number"
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <input
              value={bankCreditDraft.rate}
              onChange={(e) => setBankCreditDraft((prev) => ({ ...prev, rate: e.target.value }))}
              placeholder="Tasa %"
              type="number"
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <input
              value={bankCreditDraft.next_payment}
              onChange={(e) => setBankCreditDraft((prev) => ({ ...prev, next_payment: e.target.value }))}
              placeholder="Proximo pago (YYYY-MM-DD)"
              type="date"
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <div className="md:col-span-2 flex items-center justify-end">
              <button
                onClick={handleAddCredit}
                disabled={!canManageBank}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs disabled:opacity-50"
              >
                Agregar credito
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {bankCredits.map((credit) => (
              <div key={credit.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-white text-sm font-medium">{credit.name}</h4>
                    <p className="text-xs text-slate-400">{credit.lender}</p>
                    <p className="text-xs text-slate-500">
                      {credit.type === 'loan' ? 'Prestamo' : credit.type === 'card' ? 'Tarjeta' : 'Linea de credito'}
                    </p>
                  </div>
                  {canManageBank && (
                    <button
                      onClick={() => handleRemoveCredit(credit.id)}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-300">
                  <div>
                    <p className="text-slate-500">Cupo / limite</p>
                    <p className="text-white">{formatCurrency(credit.limit)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Saldo</p>
                    <p className="text-white">{formatCurrency(credit.balance)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Tasa</p>
                    <p className="text-white">{credit.rate ? `${credit.rate}%` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Proximo pago</p>
                    <p className="text-white">{credit.next_payment ? formatDate(credit.next_payment) : '—'}</p>
                  </div>
                </div>
              </div>
            ))}
            {bankCredits.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-4">
                No hay creditos registrados
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-white">Pagos recurrentes</h3>
            <p className="text-xs text-slate-400">Programacion de pagos automáticos o manuales.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setRecurringAutoPost((prev) => !prev)}
              disabled={!canManageBank}
              className={`px-3 py-2 rounded-lg text-xs border ${recurringAutoPost ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
            >
              Auto contabilizar: {recurringAutoPost ? 'Activo' : 'Manual'}
            </button>
            <button
              onClick={() => executeRecurringPayments({ manual: true })}
              disabled={!canManageBank}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs disabled:opacity-50"
            >
              Ejecutar pagos pendientes
            </button>
            {recurringLastRun && (
              <span className="text-xs text-slate-400">Ultima ejecucion: {formatDate(recurringLastRun)}</span>
            )}
            <button
              onClick={saveBankConfig}
              disabled={!canManageBank}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs disabled:opacity-50"
            >
              Guardar configuracion
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={recurringDraft.name}
              onChange={(e) => setRecurringDraft((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Nombre del pago"
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <input
              value={recurringDraft.provider}
              onChange={(e) => setRecurringDraft((prev) => ({ ...prev, provider: e.target.value }))}
              placeholder="Proveedor / beneficiario"
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <select
              value={recurringDraft.expense_account}
              onChange={(e) => setRecurringDraft((prev) => ({ ...prev, expense_account: e.target.value }))}
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value={CHART_OF_ACCOUNTS.EXPENSES.UTILITIES.code}>Servicios publicos</option>
              <option value={CHART_OF_ACCOUNTS.EXPENSES.RENT.code}>Alquiler</option>
              <option value={CHART_OF_ACCOUNTS.EXPENSES.BANK_FEES.code}>Gastos bancarios</option>
              <option value={CHART_OF_ACCOUNTS.EXPENSES.OTHER_EXPENSES.code}>Otros gastos</option>
            </select>
            <input
              value={recurringDraft.amount}
              onChange={(e) => setRecurringDraft((prev) => ({ ...prev, amount: e.target.value }))}
              placeholder="Monto"
              type="number"
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <select
              value={recurringDraft.frequency}
              onChange={(e) => setRecurringDraft((prev) => ({ ...prev, frequency: e.target.value }))}
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="weekly">Semanal</option>
              <option value="biweekly">Quincenal</option>
              <option value="monthly">Mensual</option>
              <option value="quarterly">Trimestral</option>
            </select>
            <input
              value={recurringDraft.day}
              onChange={(e) => setRecurringDraft((prev) => ({ ...prev, day: e.target.value }))}
              placeholder="Dia"
              type="number"
              min="1"
              max="31"
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <input
              value={recurringDraft.next_run}
              onChange={(e) => setRecurringDraft((prev) => ({ ...prev, next_run: e.target.value }))}
              placeholder="Proximo pago"
              type="date"
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            />
            <select
              value={recurringDraft.bank_account}
              onChange={(e) => setRecurringDraft((prev) => ({ ...prev, bank_account: e.target.value }))}
              disabled={!canManageBank}
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value={CHART_OF_ACCOUNTS.ASSETS.BANK.code}>Bancos</option>
              <option value={CHART_OF_ACCOUNTS.ASSETS.CASH.code}>Caja</option>
            </select>
            <div className="md:col-span-3 flex items-center justify-end">
              <button
                onClick={handleAddRecurring}
                disabled={!canManageBank}
                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs disabled:opacity-50"
              >
                Agregar pago
              </button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {recurringPayments.map((payment) => (
              <div key={payment.id} className="bg-slate-900/60 border border-slate-700 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-white text-sm font-medium">{payment.name}</h4>
                    <p className="text-xs text-slate-400">{payment.provider || 'Sin proveedor'}</p>
                    <p className="text-xs text-slate-500">
                      {payment.frequency === 'weekly' ? 'Semanal' : payment.frequency === 'biweekly' ? 'Quincenal' : payment.frequency === 'quarterly' ? 'Trimestral' : 'Mensual'}
                    </p>
                  </div>
                  {canManageBank && (
                    <button
                      onClick={() => handleRemoveRecurring(payment.id)}
                      className="text-xs text-red-300 hover:text-red-200"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-slate-300">
                  <div>
                    <p className="text-slate-500">Monto</p>
                    <p className="text-white">{formatCurrency(payment.amount)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Dia</p>
                    <p className="text-white">{payment.day}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Proximo</p>
                    <p className="text-white">{payment.next_run ? formatDate(payment.next_run) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Estado</p>
                    <p className="text-white">{bankMode === 'automated' ? 'Automatico' : 'Manual'}</p>
                  </div>
                </div>
              </div>
            ))}
            {recurringPayments.length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-4">
                No hay pagos recurrentes registrados
              </div>
            )}
          </div>
        </div>

      {/* Bank Accounts */}
      <div>
        <h3 className="font-semibold text-white mb-4">Cuentas Bancarias</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {bankAccounts.map(acc => (
            <div key={acc.id} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="text-white font-medium">{acc.name}</h4>
                  <p className="text-slate-500 text-sm">{acc.bank_name}</p>
                </div>
                <HiOutlineCreditCard className="w-6 h-6 text-indigo-400" />
              </div>
              <p className="text-slate-400 text-sm font-mono mb-2">****{acc.account_number?.slice(-4)}</p>
              <p className={`text-2xl font-bold ${acc.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(acc.balance)}
              </p>
              {acc.pending_count > 0 && (
                <p className="text-yellow-400 text-sm mt-2">{acc.pending_count} transacciones por conciliar</p>
              )}
            </div>
          ))}
          {bankAccounts.length === 0 && (
            <div className="col-span-full text-center py-8 text-slate-500">
              No hay cuentas bancarias registradas
            </div>
          )}
        </div>
      </div>

      {/* Transactions */}
      <div>
        <h3 className="font-semibold text-white mb-4">Transacciones Recientes</h3>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Fecha</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Cuenta</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">Descripción</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">Monto</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">Conciliado</th>
              </tr>
            </thead>
            <tbody>
              {bankTransactions.map(tx => (
                <tr key={tx.id} className="border-t border-slate-700/50 hover:bg-slate-700/30">
                  <td className="px-4 py-3 text-slate-300">{formatDate(tx.date)}</td>
                  <td className="px-4 py-3 text-white">{tx.account_name}</td>
                  <td className="px-4 py-3 text-slate-400">{tx.description || '-'}</td>
                  <td className={`px-4 py-3 text-right font-medium ${tx.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${tx.reconciled ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {tx.reconciled ? '✓' : 'Pendiente'}
                    </span>
                  </td>
                </tr>
              ))}
              {bankTransactions.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No hay transacciones</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    );
  };

  const ReportsTab = () => (
    <div className="space-y-6">
      {/* Balance Sheet */}
      {balanceSheet && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <HiOutlineScale className="w-5 h-5 text-indigo-400" />
            Balance General
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Activos */}
            <div>
              <h4 className="text-blue-400 font-medium mb-3 pb-2 border-b border-slate-700">ACTIVOS</h4>
              <div className="space-y-2">
                {(balanceSheet.activos || []).map(acc => (
                  <div key={acc.code} className="flex justify-between text-sm">
                    <span className="text-slate-300">{acc.name}</span>
                    <span className="text-white">{formatCurrency(acc.balance)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold mt-3 pt-2 border-t border-slate-700">
                <span className="text-blue-400">Total Activos</span>
                <span className="text-white">{formatCurrency(balanceSheet.totals?.activos)}</span>
              </div>
            </div>

            {/* Pasivos */}
            <div>
              <h4 className="text-red-400 font-medium mb-3 pb-2 border-b border-slate-700">PASIVOS</h4>
              <div className="space-y-2">
                {(balanceSheet.pasivos || []).map(acc => (
                  <div key={acc.code} className="flex justify-between text-sm">
                    <span className="text-slate-300">{acc.name}</span>
                    <span className="text-white">{formatCurrency(acc.balance)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold mt-3 pt-2 border-t border-slate-700">
                <span className="text-red-400">Total Pasivos</span>
                <span className="text-white">{formatCurrency(balanceSheet.totals?.pasivos)}</span>
              </div>
            </div>

            {/* Patrimonio */}
            <div>
              <h4 className="text-purple-400 font-medium mb-3 pb-2 border-b border-slate-700">PATRIMONIO</h4>
              <div className="space-y-2">
                {(balanceSheet.patrimonio || []).map(acc => (
                  <div key={acc.code} className="flex justify-between text-sm">
                    <span className="text-slate-300">{acc.name}</span>
                    <span className="text-white">{formatCurrency(acc.balance)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold mt-3 pt-2 border-t border-slate-700">
                <span className="text-purple-400">Total Patrimonio</span>
                <span className="text-white">{formatCurrency(balanceSheet.totals?.patrimonio)}</span>
              </div>
            </div>
          </div>

          {/* Balance Check */}
          <div className="mt-6 p-4 bg-slate-700/30 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Activos = Pasivos + Patrimonio</span>
              <span className={`font-bold ${Math.abs(balanceSheet.totals?.activos - (balanceSheet.totals?.pasivos + balanceSheet.totals?.patrimonio)) < 0.01 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(balanceSheet.totals?.activos)} = {formatCurrency(balanceSheet.totals?.pasivos + balanceSheet.totals?.patrimonio)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Income Statement */}
      {incomeStatement && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <HiOutlineChartPie className="w-5 h-5 text-green-400" />
            Estado de Resultados
          </h3>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Ingresos */}
            <div>
              <h4 className="text-green-400 font-medium mb-3 pb-2 border-b border-slate-700">INGRESOS</h4>
              <div className="space-y-2">
                {(incomeStatement.ingresos || []).map(acc => (
                  <div key={acc.code} className="flex justify-between text-sm">
                    <span className="text-slate-300">{acc.name}</span>
                    <span className="text-green-400">{formatCurrency(acc.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold mt-3 pt-2 border-t border-slate-700">
                <span className="text-green-400">Total Ingresos</span>
                <span className="text-white">{formatCurrency(incomeStatement.totals?.ingresos)}</span>
              </div>
            </div>

            {/* Gastos */}
            <div>
              <h4 className="text-yellow-400 font-medium mb-3 pb-2 border-b border-slate-700">GASTOS</h4>
              <div className="space-y-2">
                {(incomeStatement.gastos || []).map(acc => (
                  <div key={acc.code} className="flex justify-between text-sm">
                    <span className="text-slate-300">{acc.name}</span>
                    <span className="text-red-400">{formatCurrency(acc.amount)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between font-bold mt-3 pt-2 border-t border-slate-700">
                <span className="text-yellow-400">Total Gastos</span>
                <span className="text-white">{formatCurrency(incomeStatement.totals?.gastos)}</span>
              </div>
            </div>
          </div>

          {/* Net Income */}
          <div className="mt-6 p-4 bg-slate-700/30 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-xl font-bold text-white">Utilidad Neta</span>
              <span className={`text-2xl font-bold ${(incomeStatement.totals?.utilidad || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(incomeStatement.totals?.utilidad)}
              </span>
            </div>
          </div>
        </div>
      )}

      {!balanceSheet && !incomeStatement && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-12 text-center">
          <HiOutlineChartPie className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-slate-400">No hay datos para generar reportes</p>
        </div>
      )}
    </div>
  );

  // ==================== RENDER ====================
  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div></div>;
  }

  return (
    <div className="space-y-6 min-h-[calc(100vh-12rem)]">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white">{t("page.accounting", "Contabilidad")}</h1>
          <p className="text-slate-400">Plan de cuentas, asientos y reportes financieros</p>
        </div>
        <button type="button" onClick={loadData} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
          <HiOutlineRefresh className="w-5 h-5" />Actualizar
        </button>
      </div>

      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Modo contable</span>
          <select
            value={accountingStyle}
            onChange={(e) => setAccountingStyle(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="traditional">Tradicional (Cuentas y libro diario)</option>
            <option value="assisted">IA asistida (opcional)</option>
          </select>
        </div>
        {accountingStyle === 'traditional' && (
          <p className="text-xs text-slate-400">
            Tradicional activo: cuentas, subcuentas, libro diario, debe y haber.
          </p>
        )}
        {accountingStyle === 'assisted' && (
          <p className="text-xs text-slate-400">
            IA asistida es opcional. Puedes volver a Tradicional en cualquier momento.
          </p>
        )}
      </div>

      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}>
            <tab.icon className="w-4 h-4" />{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && <DashboardTab />}
      {activeTab === 'accounts' && <AccountsTab />}
      {activeTab === 'entries' && <EntriesTab />}
      {activeTab === 'bank' && <BankTab />}
      {activeTab === 'reports' && <ReportsTab />}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  const colorClasses = { blue: 'bg-blue-500/20 text-blue-400', green: 'bg-green-500/20 text-green-400', yellow: 'bg-yellow-500/20 text-yellow-400', red: 'bg-red-500/20 text-red-400' };
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 text-sm">{title}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}><Icon className="w-5 h-5" /></div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
