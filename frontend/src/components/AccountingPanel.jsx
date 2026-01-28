import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db, logAudit } from "../services/dataService";
import { formatCurrency } from "../config/businessConfig";
import accountingCore from "../core/AccountingCore";
import sentinelService, { ALERT_TYPES } from "../services/SentinelService";
import { COUNTRIES, findCountryByInput, formatCountryOption, getCountryByCode } from "../config/countries";

const STANDARD_OPTIONS = [
  { value: "ifrs", label: "IFRS (NIIF)" },
  { value: "gaap", label: "US GAAP" },
  { value: "niif_pymes", label: "NIIF para PYMES" }
];

const ACCOUNTING_COUNTRIES = [
  { id: "GLOBAL", label: "Internacional" },
  ...COUNTRIES
];

const MODE_OPTIONS = [
  { value: "manual", label: "Manual (Contador)" },
  { value: "ai_assisted", label: "IA asistida" },
  { value: "hybrid", label: "Hibrida (Usuario + IA)" }
];

const buildTree = (accounts) => {
  const byId = new Map(accounts.map((a) => [a.id, { ...a, children: [] }]));
  const roots = [];
  byId.forEach((acc) => {
    if (acc.parent && byId.has(acc.parent)) {
      byId.get(acc.parent).children.push(acc);
    } else {
      roots.push(acc);
    }
  });
  return roots;
};

const flattenTree = (nodes, level = 0) => {
  const rows = [];
  nodes.forEach((node) => {
    rows.push({ ...node, level });
    if (node.children?.length) {
      rows.push(...flattenTree(node.children, level + 1));
    }
  });
  return rows;
};

export default function AccountingPanel({ config, onConfigChange }) {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("accounts");
  const [trialBalance, setTrialBalance] = useState(null);
  const [balanceSheet, setBalanceSheet] = useState(null);
  const [incomeStatement, setIncomeStatement] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLedgerAccount, setSelectedLedgerAccount] = useState(null);
  const [fiscalPrefix, setFiscalPrefix] = useState("INV");
  const [fiscalSeq, setFiscalSeq] = useState(1);
  const [fiscalLength, setFiscalLength] = useState(8);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [periodClosed, setPeriodClosed] = useState(false);
  const [accountantName, setAccountantName] = useState("");
  const [closureNotes, setClosureNotes] = useState("");
  const [closureSignature, setClosureSignature] = useState("");
  const [closures, setClosures] = useState([]);
  const [countryQuery, setCountryQuery] = useState("");

  const accounts = useLiveQuery(async () => {
    return await db.accounts?.where("active").equals(1).toArray() || [];
  }, []) || [];

  const journalEntries = useLiveQuery(async () => {
    return await db.journalEntries?.toArray() || [];
  }, []) || [];

  const journalLines = useLiveQuery(async () => {
    return await db.journalLines?.toArray() || [];
  }, []) || [];

  const auditEvents = useLiveQuery(async () => {
    const rows = await db.auditLog?.toArray() || [];
    return rows
      .filter((row) => ["accounting", "journal", "account", "cash_session", "sale"].includes(row.entity_type))
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 100);
  }, []) || [];

  useEffect(() => {
    if (config.country === "global") {
      setCountryQuery("Internacional (GLOBAL)");
      return;
    }
    const selected = getCountryByCode(config.country);
    if (selected) setCountryQuery(formatCountryOption(selected));
  }, [config.country]);

  useEffect(() => {
    const loadPeriod = async () => {
      try {
        const start = await db.settings?.get("accounting_period_start");
        const end = await db.settings?.get("accounting_period_end");
        const closed = await db.settings?.get("accounting_period_closed");
        if (start?.value) setPeriodStart(start.value);
        if (end?.value) setPeriodEnd(end.value);
        if (closed?.value !== undefined) setPeriodClosed(closed.value === "true" || closed.value === true);
      } catch {}
    };
    loadPeriod();
    loadClosures().then(async (loaded) => {
      const next = {};
      for (const closure of loaded.slice(0, 5)) {
        next[closure.id] = await validateClosureHash(closure);
        if (!next[closure.id]) {
          await logAudit("accounting", closure.id, "period_tamper", null, {
            period_start: closure.period_start,
            period_end: closure.period_end
          });
          sentinelService.addAlert(
            ALERT_TYPES.DATA_CORRUPTION,
            "Alteracion detectada en cierre contable",
            {
              stage: "contabilidad",
              closure_id: closure.id,
              period_start: closure.period_start,
              period_end: closure.period_end
            }
          );
        }
      }
      setClosureValidation(next);
    });
  }, []);

  const filteredAccounts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const tree = buildTree(accounts);
    const flat = flattenTree(tree);
    if (!term) return flat;
    return flat.filter((acc) => {
      return String(acc.name || "").toLowerCase().includes(term) ||
        String(acc.code || "").toLowerCase().includes(term);
    });
  }, [accounts, search]);

  const linesByEntry = useMemo(() => {
    return journalLines.reduce((acc, line) => {
      const key = line.entry_id || line.entryId;
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(line);
      return acc;
    }, {});
  }, [journalLines]);

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    return journalEntries.filter((entry) => {
      const entryDate = entry.date || entry.created_at || entry.timestamp;
      if (startDate && entryDate && new Date(entryDate) < new Date(startDate)) return false;
      if (endDate && entryDate && new Date(entryDate) > new Date(`${endDate}T23:59:59`)) return false;
      if (!term) return true;
      return String(entry.description || entry.reference || entry.id || "").toLowerCase().includes(term);
    });
  }, [journalEntries, search, startDate, endDate]);

  const accountIndex = useMemo(() => {
    return accounts.reduce((acc, account) => {
      acc[account.code || account.id] = account;
      return acc;
    }, {});
  }, [accounts]);

  const ledgerRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const entryDates = journalEntries.reduce((acc, entry) => {
      acc[entry.id] = entry.date || entry.created_at || entry.timestamp;
      return acc;
    }, {});
    const grouped = journalLines.reduce((acc, line) => {
      const key = line.account_code || line.account_id || "sin_cuenta";
      const entryDate = entryDates[line.entry_id || line.entryId];
      if (startDate && entryDate && new Date(entryDate) < new Date(startDate)) return acc;
      if (endDate && entryDate && new Date(entryDate) > new Date(`${endDate}T23:59:59`)) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(line);
      return acc;
    }, {});

    return Object.entries(grouped)
      .filter(([key]) => {
        if (!term) return true;
        const account = accountIndex[key];
        return String(key).toLowerCase().includes(term) ||
          String(account?.name || "").toLowerCase().includes(term);
      })
      .map(([key, lines]) => {
        const debit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
        const credit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
        return {
          key,
          account: accountIndex[key],
          debit,
          credit,
          balance: debit - credit,
          lines
        };
      })
      .sort((a, b) => String(a.key).localeCompare(String(b.key)));
  }, [journalLines, journalEntries, accountIndex, search, startDate, endDate]);

  const exportCSV = (filename, header, rows) => {
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = [
      header.join(","),
      ...rows.map((row) => row.map(escape).join(","))
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const exportPDF = (title, header, rows) => {
    const tableRows = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 18px; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background: #f2f2f2; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <table>
            <thead>
              <tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const exportLedgerCSV = () => {
    exportCSV("libro_mayor.csv", ["Cuenta", "Nombre", "Debito", "Credito", "Saldo"], ledgerRows.map((row) => [
      row.key,
      row.account?.name || "-",
      row.debit,
      row.credit,
      row.balance
    ]));
  };

  const exportLedgerPDF = () => {
    exportPDF("Libro mayor", ["Cuenta", "Nombre", "Debito", "Credito", "Saldo"], ledgerRows.map((row) => [
      row.key,
      row.account?.name || "-",
      formatCurrency(row.debit),
      formatCurrency(row.credit),
      formatCurrency(row.balance)
    ]));
  };

  const exportJournalCSV = () => {
    exportCSV("libro_diario.csv", ["Fecha", "Referencia", "Descripcion", "Debito", "Credito"], filteredEntries.map((entry) => {
      const lines = linesByEntry[entry.id] || [];
      const debit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
      const credit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
      return [
        entry.date || entry.created_at || entry.timestamp || "-",
        entry.reference || entry.reference_id || entry.id,
        entry.description || entry.type || "Asiento contable",
        debit,
        credit
      ];
    }));
  };

  const exportJournalPDF = () => {
    exportPDF("Libro diario", ["Fecha", "Referencia", "Descripcion", "Debito", "Credito"], filteredEntries.map((entry) => {
      const lines = linesByEntry[entry.id] || [];
      const debit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
      const credit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
      return [
        entry.date || entry.created_at || entry.timestamp || "-",
        entry.reference || entry.reference_id || entry.id,
        entry.description || entry.type || "Asiento contable",
        formatCurrency(debit),
        formatCurrency(credit)
      ];
    }));
  };

  const exportTrialBalanceCSV = () => {
    if (!trialBalance?.accounts?.length) return;
    exportCSV("balance_comprobacion.csv", ["Cuenta", "Nombre", "Debe", "Haber"], trialBalance.accounts.map((acc) => [
      acc.code,
      acc.name,
      acc.debit,
      acc.credit
    ]));
  };

  const exportTrialBalancePDF = () => {
    if (!trialBalance?.accounts?.length) return;
    exportPDF("Balance de comprobacion", ["Cuenta", "Nombre", "Debe", "Haber"], trialBalance.accounts.map((acc) => [
      acc.code,
      acc.name,
      formatCurrency(acc.debit),
      formatCurrency(acc.credit)
    ]));
  };

  const exportBalanceSheetCSV = () => {
    if (!balanceSheet) return;
    exportCSV("balance_general.csv", ["Seccion", "Total"], [
      ["Activos", balanceSheet.assets.total],
      ["Pasivos", balanceSheet.liabilities.total],
      ["Patrimonio", balanceSheet.equity.total],
      ["Resultado", balanceSheet.equity.netIncome]
    ]);
  };

  const exportBalanceSheetPDF = () => {
    if (!balanceSheet) return;
    exportPDF("Balance general", ["Seccion", "Total"], [
      ["Activos", formatCurrency(balanceSheet.assets.total)],
      ["Pasivos", formatCurrency(balanceSheet.liabilities.total)],
      ["Patrimonio", formatCurrency(balanceSheet.equity.total)],
      ["Resultado", formatCurrency(balanceSheet.equity.netIncome)]
    ]);
  };

  const exportIncomeCSV = () => {
    if (!incomeStatement) return;
    exportCSV("estado_resultados.csv", ["Seccion", "Total"], [
      ["Ingresos", incomeStatement.revenue.total],
      ["Costos", incomeStatement.costs.total],
      ["Gastos", incomeStatement.expenses.total],
      ["Utilidad Neta", incomeStatement.netIncome]
    ]);
  };

  const exportIncomePDF = () => {
    if (!incomeStatement) return;
    exportPDF("Estado de resultados", ["Seccion", "Total"], [
      ["Ingresos", formatCurrency(incomeStatement.revenue.total)],
      ["Costos", formatCurrency(incomeStatement.costs.total)],
      ["Gastos", formatCurrency(incomeStatement.expenses.total)],
      ["Utilidad Neta", formatCurrency(incomeStatement.netIncome)]
    ]);
  };

  const generateFiscalNumber = () => {
    const padded = String(fiscalSeq).padStart(fiscalLength, "0");
    return `${fiscalPrefix}-${padded}`;
  };

  const advanceFiscal = () => {
    setFiscalSeq((prev) => prev + 1);
  };

  const closePeriod = () => {
    if (!periodStart || !periodEnd) return;
    setPeriodClosed(true);
  };

  const reopenPeriod = () => {
    setPeriodClosed(false);
  };

  const savePeriodConfig = async () => {
    await db.settings?.put({ key: "accounting_period_start", value: periodStart });
    await db.settings?.put({ key: "accounting_period_end", value: periodEnd });
    await db.settings?.put({ key: "accounting_period_closed", value: periodClosed.toString() });
  };

  const loadClosures = async () => {
    try {
      const stored = await db.settings?.get("accounting_closures");
      if (stored?.value) {
        const parsed = JSON.parse(stored.value);
        setClosures(parsed);
        return parsed;
      }
    } catch {}
    return [];
  };

  const handleSignatureUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const data = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.readAsDataURL(file);
    });
    setClosureSignature(data);
  };

  const saveClosure = async () => {
    if (!periodStart || !periodEnd) return;
    const closure = {
      id: `close_${Date.now()}`,
      period_start: periodStart,
      period_end: periodEnd,
      closed_at: new Date().toISOString(),
      accountant_name: accountantName || "Sin nombre",
      notes: closureNotes || "",
      signature: closureSignature || ""
    };
    const hashPayload = JSON.stringify({
      period_start: closure.period_start,
      period_end: closure.period_end,
      closed_at: closure.closed_at,
      accountant_name: closure.accountant_name,
      notes: closure.notes
    });
    const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(hashPayload));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    closure.hash = hashHex;
    const next = [closure, ...closures].slice(0, 20);
    setClosures(next);
    await db.settings?.put({ key: "accounting_closures", value: JSON.stringify(next) });
    await logAudit("accounting", closure.id, "period_close", null, {
      period_start: closure.period_start,
      period_end: closure.period_end,
      accountant_name: closure.accountant_name,
      hash: closure.hash
    });
    setClosureNotes("");
  };

  const exportClosurePDF = (closure) => {
    if (!closure) return;
    const signatureBlock = closure.signature
      ? `<img src="${closure.signature}" alt="Firma" style="max-width: 240px; margin-top: 8px;" />`
      : "<div style='margin-top:8px;'>Sin firma</div>";
    const html = `
      <html>
        <head>
          <title>Bitacora de cierre</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { font-size: 18px; margin-bottom: 16px; }
            .row { margin-bottom: 8px; }
            .label { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>Bitacora de cierre contable</h1>
          <div class="row"><span class="label">Periodo:</span> ${closure.period_start} - ${closure.period_end}</div>
          <div class="row"><span class="label">Cerrado el:</span> ${closure.closed_at}</div>
          <div class="row"><span class="label">Contador:</span> ${closure.accountant_name}</div>
          <div class="row"><span class="label">Notas:</span> ${closure.notes || "-"}</div>
          <div class="row"><span class="label">Hash:</span> ${closure.hash || "-"}</div>
          <div class="row"><span class="label">Firma:</span> ${signatureBlock}</div>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  const validateClosureHash = async (closure) => {
    if (!closure?.hash) return false;
    const payload = JSON.stringify({
      period_start: closure.period_start,
      period_end: closure.period_end,
      closed_at: closure.closed_at,
      accountant_name: closure.accountant_name,
      notes: closure.notes
    });
    const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    const hex = Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
    return hex === closure.hash;
  };

  const [closureValidation, setClosureValidation] = useState({});

  useEffect(() => {
    const loadReports = async () => {
      if (!["trial", "balance", "income"].includes(activeTab)) return;
      setIsLoadingReport(true);
      try {
        await accountingCore.initialize();
        if (activeTab === "trial") {
          setTrialBalance(await accountingCore.getTrialBalance());
        }
        if (activeTab === "balance") {
          setBalanceSheet(await accountingCore.getBalanceSheet());
        }
        if (activeTab === "income") {
          setIncomeStatement(await accountingCore.getIncomeStatement());
        }
      } catch (error) {
        console.error("Error contable:", error);
      } finally {
        setIsLoadingReport(false);
      }
    };
    loadReports();
  }, [activeTab]);

  return (
    <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Contabilidad</h2>
          <p className="text-xs text-slate-400">Plan contable, libro diario, libro mayor y reportes estándar</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={config.standard}
            onChange={(e) => onConfigChange({ standard: e.target.value })}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          >
            {STANDARD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div className="relative">
            <input
              value={countryQuery}
              onChange={(e) => {
                const value = e.target.value;
                setCountryQuery(value);
                if (value.toUpperCase().includes("GLOBAL") || value.toLowerCase() === "internacional") {
                  onConfigChange({ country: "global" });
                  return;
                }
                const next = findCountryByInput(value);
                if (next) onConfigChange({ country: next.id.toLowerCase() });
              }}
              list="accounting-country-options"
              placeholder="Buscar país"
              className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
            <datalist id="accounting-country-options">
              {ACCOUNTING_COUNTRIES.map((c) => (
                <option key={c.id} value={c.id === "GLOBAL" ? "Internacional (GLOBAL)" : formatCountryOption(c)} />
              ))}
            </datalist>
          </div>
          <select
            value={config.mode}
            onChange={(e) => onConfigChange({ mode: e.target.value })}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          >
            {MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 bg-slate-900/40 p-2 rounded-xl">
        <button
          onClick={() => setActiveTab("accounts")}
          className={`px-3 py-2 rounded-lg text-sm ${activeTab === "accounts" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
        >
          Plan de cuentas
        </button>
        <button
          onClick={() => setActiveTab("journal")}
          className={`px-3 py-2 rounded-lg text-sm ${activeTab === "journal" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
        >
          Libro diario
        </button>
        <button
          onClick={() => setActiveTab("events")}
          className={`px-3 py-2 rounded-lg text-sm ${activeTab === "events" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
        >
          Registro de eventos
        </button>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-3 py-2 rounded-lg text-sm ${activeTab === "ledger" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
        >
          Libro mayor
        </button>
        <button
          onClick={() => setActiveTab("trial")}
          className={`px-3 py-2 rounded-lg text-sm ${activeTab === "trial" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
        >
          Balance de comprobacion
        </button>
        <button
          onClick={() => setActiveTab("balance")}
          className={`px-3 py-2 rounded-lg text-sm ${activeTab === "balance" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
        >
          Balance general
        </button>
        <button
          onClick={() => setActiveTab("income")}
          className={`px-3 py-2 rounded-lg text-sm ${activeTab === "income" ? "bg-violet-600 text-white" : "text-slate-400 hover:text-white"}`}
        >
          Estado de resultados
        </button>
      </div>

      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por codigo, cuenta o descripcion..."
          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
        />
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2 text-xs">
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300 space-y-2">
          <div className="font-semibold text-slate-300">Numeracion fiscal</div>
          <div className="flex flex-wrap gap-2">
            <input
              value={fiscalPrefix}
              onChange={(e) => setFiscalPrefix(e.target.value.toUpperCase())}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white w-20"
              placeholder="INV"
            />
            <input
              type="number"
              min="1"
              value={fiscalSeq}
              onChange={(e) => setFiscalSeq(Number(e.target.value || 1))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white w-24"
            />
            <input
              type="number"
              min="4"
              value={fiscalLength}
              onChange={(e) => setFiscalLength(Number(e.target.value || 8))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white w-20"
            />
            <span className="text-slate-400">Ejemplo: {generateFiscalNumber()}</span>
          </div>
          <button
            onClick={advanceFiscal}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs"
          >
            Avanzar numeracion
          </button>
        </div>
        <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300 space-y-2">
          <div className="font-semibold text-slate-300">Cierre de periodo</div>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
            />
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-white"
            />
            {!periodClosed ? (
              <button
                onClick={closePeriod}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs"
              >
                Cerrar periodo
              </button>
            ) : (
              <button
                onClick={reopenPeriod}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs"
              >
                Reabrir periodo
              </button>
            )}
          </div>
          <div className={`text-xs ${periodClosed ? "text-rose-300" : "text-emerald-300"}`}>
            Estado: {periodClosed ? "Cerrado" : "Abierto"}
          </div>
          <button
            onClick={savePeriodConfig}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs"
          >
            Guardar periodo
          </button>
        </div>
      </div>

      <div className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-3 text-slate-300 space-y-3">
        <div className="font-semibold text-slate-300">Bitacora de cierre</div>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            value={accountantName}
            onChange={(e) => setAccountantName(e.target.value)}
            placeholder="Nombre del contador"
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
          <input
            type="file"
            accept="image/*"
            onChange={handleSignatureUpload}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          />
        </div>
        <textarea
          value={closureNotes}
          onChange={(e) => setClosureNotes(e.target.value)}
          placeholder="Notas del cierre contable"
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
          rows={3}
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={saveClosure}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs"
          >
            Guardar cierre
          </button>
          {closures[0] && (
            <button
              onClick={() => exportClosurePDF(closures[0])}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs"
            >
              Exportar ultimo cierre PDF
            </button>
          )}
        </div>
        {closures.length > 0 && (
          <div className="space-y-2">
            {closures.slice(0, 5).map((closure) => (
              <div key={closure.id} className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                <span>{closure.period_start} - {closure.period_end} • {closure.accountant_name} • {closure.hash?.slice(0, 10)}...</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      const ok = await validateClosureHash(closure);
                      setClosureValidation((prev) => ({ ...prev, [closure.id]: ok }));
                    }}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded"
                  >
                    Validar
                  </button>
                  {closureValidation[closure.id] !== undefined && (
                    <span className={`px-2 py-0.5 rounded ${
                      closureValidation[closure.id] ? "bg-emerald-500/20 text-emerald-200" : "bg-rose-500/20 text-rose-200"
                    }`}>
                      {closureValidation[closure.id] ? "Integridad OK" : "Alterado"}
                    </span>
                  )}
                  <button
                    onClick={() => exportClosurePDF(closure)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded"
                  >
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeTab === "accounts" && (
        <div className="space-y-3">
          {filteredAccounts.length === 0 ? (
            <div className="text-slate-500 text-center py-6">Sin cuentas registradas</div>
          ) : (
            <div className="space-y-2">
              {filteredAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between bg-slate-900/50 border border-slate-700/40 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-xs" style={{ marginLeft: account.level * 12 }}>
                      {account.code || account.id}
                    </span>
                    <span className="text-white">{account.name}</span>
                    {account.parent && <span className="text-xs text-slate-500">Subcuenta</span>}
                  </div>
                  <span className="text-xs text-slate-400">{account.type || "-"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "journal" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={exportJournalPDF}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm mr-2"
            >
              Exportar PDF
            </button>
            <button
              onClick={exportJournalCSV}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
            >
              Exportar CSV
            </button>
          </div>
          {filteredEntries.length === 0 ? (
            <div className="text-slate-500 text-center py-6">Sin asientos en el libro diario</div>
          ) : filteredEntries.map((entry) => {
            const lines = linesByEntry[entry.id] || [];
            const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
            const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
            return (
              <div key={entry.id} className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between text-slate-400 text-xs">
                  <span>{entry.date || entry.created_at || "-"}</span>
                  <span>{entry.reference || entry.reference_id || entry.id}</span>
                </div>
                <div className="text-white font-medium">{entry.description || entry.type || "Asiento contable"}</div>
                <div className="mt-2 text-xs text-slate-400">
                  Debito: {formatCurrency(totalDebit)} • Credito: {formatCurrency(totalCredit)}
                </div>
                {lines.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {lines.map((line) => (
                      <div key={line.id} className="flex items-center justify-between text-xs text-slate-300">
                        <span>{line.account_code || line.account_id || "Cuenta"}</span>
                        <span>{formatCurrency((line.debit || 0) - (line.credit || 0))}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "events" && (
        <div className="space-y-3">
          {auditEvents.length === 0 ? (
            <div className="text-slate-500 text-center py-6">Sin eventos contables</div>
          ) : auditEvents.map((entry) => (
            <div key={entry.id} className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>{entry.entity_type} • {entry.action}</span>
                <span>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "-"}</span>
              </div>
              <div className="text-white mt-1">ID: {entry.entity_id}</div>
              <div className="text-xs text-slate-500">Usuario: {entry.user_id || "-"}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "ledger" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={exportLedgerPDF}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm mr-2"
            >
              Exportar PDF
            </button>
            <button
              onClick={exportLedgerCSV}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
            >
              Exportar CSV
            </button>
          </div>
          {ledgerRows.length === 0 ? (
            <div className="text-slate-500 text-center py-6">Sin movimientos contables</div>
          ) : ledgerRows.map((row) => (
            <div key={row.key} className="bg-slate-900/60 border border-slate-700/50 rounded-lg p-3">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <button
                  onClick={() => setSelectedLedgerAccount(row.key === selectedLedgerAccount ? null : row.key)}
                  className="text-left hover:text-white"
                >
                  {row.key} • {row.account?.name || "Cuenta"}
                </button>
                <span>Saldo: {formatCurrency(row.balance)}</span>
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Debito: {formatCurrency(row.debit)} • Credito: {formatCurrency(row.credit)}
              </div>
              {selectedLedgerAccount === row.key && row.lines.length > 0 && (
                <div className="mt-3 space-y-1 text-xs text-slate-300">
                  {row.lines.map((line) => (
                    <div key={line.id} className="flex items-center justify-between">
                      <span>{line.description || line.account_code || line.account_id}</span>
                      <span>{formatCurrency((line.debit || 0) - (line.credit || 0))}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "trial" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={exportTrialBalancePDF}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm mr-2"
            >
              Exportar PDF
            </button>
            <button
              onClick={exportTrialBalanceCSV}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
            >
              Exportar CSV
            </button>
          </div>
          {isLoadingReport && <div className="text-slate-500 text-center py-6">Cargando balance...</div>}
          {!isLoadingReport && trialBalance?.accounts?.length === 0 && (
            <div className="text-slate-500 text-center py-6">Sin datos en balance de comprobacion</div>
          )}
          {!isLoadingReport && trialBalance?.accounts?.length > 0 && (
            <div className="space-y-2">
              {trialBalance.accounts.map((acc) => (
                <div key={acc.code} className="flex items-center justify-between bg-slate-900/50 border border-slate-700/40 rounded-lg px-3 py-2 text-xs">
                  <span className="text-slate-300">{acc.code} • {acc.name}</span>
                  <span className="text-slate-400">Debe: {formatCurrency(acc.debit)} • Haber: {formatCurrency(acc.credit)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-sm text-slate-300">
                <span>Total</span>
                <span>Debe: {formatCurrency(trialBalance.totals.debit)} • Haber: {formatCurrency(trialBalance.totals.credit)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "balance" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={exportBalanceSheetPDF}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm mr-2"
            >
              Exportar PDF
            </button>
            <button
              onClick={exportBalanceSheetCSV}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
            >
              Exportar CSV
            </button>
          </div>
          {isLoadingReport && <div className="text-slate-500 text-center py-6">Cargando balance general...</div>}
          {!isLoadingReport && balanceSheet && (
            <div className="grid gap-3 md:grid-cols-3 text-xs">
              <div className="bg-slate-900/50 border border-slate-700/40 rounded-lg p-3">
                <div className="text-slate-400 mb-2">Activos</div>
                <div className="text-white font-semibold">{formatCurrency(balanceSheet.assets.total)}</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/40 rounded-lg p-3">
                <div className="text-slate-400 mb-2">Pasivos</div>
                <div className="text-white font-semibold">{formatCurrency(balanceSheet.liabilities.total)}</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/40 rounded-lg p-3">
                <div className="text-slate-400 mb-2">Patrimonio</div>
                <div className="text-white font-semibold">{formatCurrency(balanceSheet.equity.total)}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "income" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={exportIncomePDF}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm mr-2"
            >
              Exportar PDF
            </button>
            <button
              onClick={exportIncomeCSV}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm"
            >
              Exportar CSV
            </button>
          </div>
          {isLoadingReport && <div className="text-slate-500 text-center py-6">Cargando estado de resultados...</div>}
          {!isLoadingReport && incomeStatement && (
            <div className="grid gap-3 md:grid-cols-3 text-xs">
              <div className="bg-slate-900/50 border border-slate-700/40 rounded-lg p-3">
                <div className="text-slate-400 mb-2">Ingresos</div>
                <div className="text-white font-semibold">{formatCurrency(incomeStatement.revenue.total)}</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/40 rounded-lg p-3">
                <div className="text-slate-400 mb-2">Costos</div>
                <div className="text-white font-semibold">{formatCurrency(incomeStatement.costs.total)}</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-700/40 rounded-lg p-3">
                <div className="text-slate-400 mb-2">Utilidad neta</div>
                <div className="text-white font-semibold">{formatCurrency(incomeStatement.netIncome)}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
