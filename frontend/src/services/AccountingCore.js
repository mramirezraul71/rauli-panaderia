/**
 * GENESIS - Accounting Core
 * Motor Contable con Partida Doble y Sistema de Amortización de Inversión
 */

const getApiBase = () => {
  try {
    const base = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) || "";
    return String(base).replace(/\/$/, "");
  } catch {
    return "";
  }
};

const apiUrl = (path) => {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
};

// ==================== TIPOS DE CUENTAS ====================

export const ACCOUNT_TYPES = {
  ACTIVO_CIRCULANTE: { code: '1100', name: 'Activo Circulante', nature: 'debit' },
  ACTIVO_FIJO: { code: '1200', name: 'Activo Fijo', nature: 'debit' },
  PASIVO_CORTO: { code: '2100', name: 'Pasivo a Corto Plazo', nature: 'credit' },
  PASIVO_LARGO: { code: '2200', name: 'Pasivo a Largo Plazo', nature: 'credit' },
  CAPITAL: { code: '3000', name: 'Capital', nature: 'credit' },
  INGRESOS: { code: '4000', name: 'Ingresos', nature: 'credit' },
  GASTOS: { code: '5000', name: 'Gastos', nature: 'debit' },
  COSTOS: { code: '6000', name: 'Costos', nature: 'debit' }
};

// ==================== CUENTAS PREDEFINIDAS ====================

export const DEFAULT_ACCOUNTS = [
  // Activos Circulantes
  { code: '1101', name: 'Caja General', type: 'activo_circulante', nature: 'debit', editable: true },
  { code: '1102', name: 'Caja Chica', type: 'activo_circulante', nature: 'debit', editable: true },
  { code: '1103', name: 'Bancos', type: 'activo_circulante', nature: 'debit', editable: true },
  { code: '1104', name: 'Cuentas por Cobrar', type: 'activo_circulante', nature: 'debit', editable: true },
  { code: '1105', name: 'Inventario de Mercancías', type: 'activo_circulante', nature: 'debit', editable: true },
  { code: '1106', name: 'Inventario Materia Prima', type: 'activo_circulante', nature: 'debit', editable: true },
  
  // Activos Fijos
  { code: '1201', name: 'Mobiliario y Equipo', type: 'activo_fijo', nature: 'debit', editable: true },
  { code: '1202', name: 'Equipo de Cómputo', type: 'activo_fijo', nature: 'debit', editable: true },
  { code: '1203', name: 'Maquinaria (Hornos)', type: 'activo_fijo', nature: 'debit', editable: true },
  { code: '1204', name: 'Vehículos', type: 'activo_fijo', nature: 'debit', editable: true },
  { code: '1205', name: 'Depreciación Acumulada', type: 'activo_fijo', nature: 'credit', editable: true },
  
  // Pasivos Corto Plazo
  { code: '2101', name: 'Proveedores', type: 'pasivo_corto', nature: 'credit', editable: true },
  { code: '2102', name: 'Acreedores Diversos', type: 'pasivo_corto', nature: 'credit', editable: true },
  { code: '2103', name: 'Impuestos por Pagar', type: 'pasivo_corto', nature: 'credit', editable: true },
  { code: '2104', name: 'Sueldos por Pagar', type: 'pasivo_corto', nature: 'credit', editable: true },
  
  // Pasivos Largo Plazo
  { code: '2201', name: 'Préstamos Bancarios', type: 'pasivo_largo', nature: 'credit', editable: true },
  { code: '2202', name: 'Inversión por Amortizar', type: 'pasivo_largo', nature: 'credit', editable: false, system: true },
  
  // Capital
  { code: '3101', name: 'Capital Social', type: 'capital', nature: 'credit', editable: true },
  { code: '3102', name: 'Utilidades Retenidas', type: 'capital', nature: 'credit', editable: true },
  { code: '3103', name: 'Utilidad del Ejercicio', type: 'capital', nature: 'credit', editable: false, system: true },
  { code: '3104', name: 'Inversión Recuperada', type: 'capital', nature: 'credit', editable: false, system: true },
  
  // Ingresos
  { code: '4101', name: 'Ventas', type: 'ingresos', nature: 'credit', editable: true },
  { code: '4102', name: 'Otros Ingresos', type: 'ingresos', nature: 'credit', editable: true },
  { code: '4103', name: 'Descuentos sobre Ventas', type: 'ingresos', nature: 'debit', editable: true },
  
  // Gastos
  { code: '5101', name: 'Sueldos y Salarios', type: 'gastos', nature: 'debit', editable: true },
  { code: '5102', name: 'Renta', type: 'gastos', nature: 'debit', editable: true },
  { code: '5103', name: 'Servicios (Luz, Agua, Gas)', type: 'gastos', nature: 'debit', editable: true },
  { code: '5104', name: 'Teléfono e Internet', type: 'gastos', nature: 'debit', editable: true },
  { code: '5105', name: 'Publicidad', type: 'gastos', nature: 'debit', editable: true },
  { code: '5106', name: 'Mantenimiento', type: 'gastos', nature: 'debit', editable: true },
  { code: '5107', name: 'Gastos Diversos', type: 'gastos', nature: 'debit', editable: true },
  { code: '5108', name: 'Depreciación', type: 'gastos', nature: 'debit', editable: true },
  
  // Costos
  { code: '6101', name: 'Costo de Ventas', type: 'costos', nature: 'debit', editable: true },
  { code: '6102', name: 'Costo de Materia Prima', type: 'costos', nature: 'debit', editable: true },
  { code: '6103', name: 'Mermas y Desperdicios', type: 'costos', nature: 'debit', editable: true }
];

// ==================== CLASE PRINCIPAL ====================

class AccountingCore {
  constructor() {
    this.accounts = [];
    this.entries = [];
    this.investment = null;
  }

  // ==================== GESTIÓN DE CUENTAS (CRUD) ====================

  async loadAccounts() {
    try {
      const response = await fetch(apiUrl("/api/accounting/accounts"));
      if (response.ok) {
        const data = await response.json();
        this.accounts = data.accounts || [];
        return this.accounts;
      }
    } catch (error) {
      console.error('Error cargando cuentas:', error);
    }
    return [];
  }

  async createAccount(accountData) {
    // Validar datos
    const validation = this.validateAccount(accountData);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const response = await fetch(apiUrl("/api/accounting/accounts"), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountData)
      });

      if (response.ok) {
        const data = await response.json();
        this.accounts.push(data.account);
        return { success: true, account: data.account };
      } else {
        const error = await response.json();
        return { success: false, error: error.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateAccount(accountId, accountData) {
    const account = this.accounts.find(a => a.id === accountId);
    if (account && account.system) {
      return { success: false, error: 'No se pueden modificar cuentas del sistema' };
    }

    try {
      const response = await fetch(apiUrl(`/api/accounting/accounts/${accountId}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountData)
      });

      if (response.ok) {
        const data = await response.json();
        const index = this.accounts.findIndex(a => a.id === accountId);
        if (index !== -1) {
          this.accounts[index] = data.account;
        }
        return { success: true, account: data.account };
      } else {
        const error = await response.json();
        return { success: false, error: error.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteAccount(accountId) {
    const account = this.accounts.find(a => a.id === accountId);
    if (account && account.system) {
      return { success: false, error: 'No se pueden eliminar cuentas del sistema' };
    }

    // Verificar que no tenga movimientos
    if (account && account.balance !== 0) {
      return { success: false, error: 'No se puede eliminar una cuenta con saldo' };
    }

    try {
      const response = await fetch(apiUrl(`/api/accounting/accounts/${accountId}`), {
        method: 'DELETE'
      });

      if (response.ok) {
        this.accounts = this.accounts.filter(a => a.id !== accountId);
        return { success: true };
      } else {
        const error = await response.json();
        return { success: false, error: error.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  validateAccount(accountData) {
    if (!accountData.code || accountData.code.length < 4) {
      return { valid: false, error: 'Código de cuenta inválido (mínimo 4 dígitos)' };
    }
    if (!accountData.name || accountData.name.length < 3) {
      return { valid: false, error: 'Nombre de cuenta muy corto' };
    }
    if (!accountData.type) {
      return { valid: false, error: 'Debe seleccionar un tipo de cuenta' };
    }
    // Verificar código único
    if (this.accounts.some(a => a.code === accountData.code)) {
      return { valid: false, error: 'Ya existe una cuenta con ese código' };
    }
    return { valid: true };
  }

  getAccountsByType(type) {
    return this.accounts.filter(a => a.type === type);
  }

  getAccountByCode(code) {
    return this.accounts.find(a => a.code === code);
  }

  // ==================== ASIENTOS CONTABLES (PARTIDA DOBLE) ====================

  async createJournalEntry(entryData) {
    // Validar partida doble
    const validation = this.validateDoubleEntry(entryData);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const response = await fetch('/api/accounting/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryData)
      });

      if (response.ok) {
        const data = await response.json();
        return { success: true, entry: data.entry };
      } else {
        const error = await response.json();
        return { success: false, error: error.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  validateDoubleEntry(entryData) {
    const { lines } = entryData;

    if (!lines || lines.length < 2) {
      return { valid: false, error: 'Un asiento debe tener al menos 2 líneas' };
    }

    const totalDebit = lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { 
        valid: false, 
        error: `La partida no cuadra. Debe: ${totalDebit.toFixed(2)}, Haber: ${totalCredit.toFixed(2)}` 
      };
    }

    // Verificar que cada línea tenga cuenta válida
    for (const line of lines) {
      if (!line.account_id && !line.account_code) {
        return { valid: false, error: 'Cada línea debe tener una cuenta asignada' };
      }
      if (!line.debit && !line.credit) {
        return { valid: false, error: 'Cada línea debe tener un monto en Debe o Haber' };
      }
    }

    return { valid: true };
  }

  // ==================== SISTEMA DE AMORTIZACIÓN DE INVERSIÓN ====================

  async loadInvestment() {
    try {
      const response = await fetch(apiUrl("/api/accounting/investment"));
      if (response.ok) {
        const data = await response.json();
        this.investment = data.investment;
        return this.investment;
      }
    } catch (error) {
      console.error('Error cargando inversión:', error);
    }
    return null;
  }

  async saveInvestment(investmentData) {
    try {
      const response = await fetch('/api/accounting/investment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(investmentData)
      });

      if (response.ok) {
        const data = await response.json();
        this.investment = data.investment;
        return { success: true, investment: data.investment };
      } else {
        const error = await response.json();
        return { success: false, error: error.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateInvestment(investmentData) {
    try {
      const response = await fetch('/api/accounting/investment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(investmentData)
      });

      if (response.ok) {
        const data = await response.json();
        this.investment = data.investment;
        return { success: true, investment: data.investment };
      } else {
        const error = await response.json();
        return { success: false, error: error.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Calcular amortización basada en ventas
  calculateAmortizationFromSale(saleTotal) {
    if (!this.investment || !this.investment.return_percentage) {
      return 0;
    }

    const percentage = parseFloat(this.investment.return_percentage) / 100;
    const amortization = saleTotal * percentage;

    return Math.min(amortization, this.getInvestmentRemaining());
  }

  // Calcular amortización basada en utilidad mensual
  calculateAmortizationFromProfit(monthlyProfit) {
    if (!this.investment || !this.investment.profit_percentage) {
      return 0;
    }

    const percentage = parseFloat(this.investment.profit_percentage) / 100;
    const amortization = monthlyProfit * percentage;

    return Math.min(amortization, this.getInvestmentRemaining());
  }

  getInvestmentTotal() {
    return this.investment ? parseFloat(this.investment.total_amount) || 0 : 0;
  }

  getInvestmentRecovered() {
    return this.investment ? parseFloat(this.investment.recovered_amount) || 0 : 0;
  }

  getInvestmentRemaining() {
    return this.getInvestmentTotal() - this.getInvestmentRecovered();
  }

  getInvestmentProgress() {
    const total = this.getInvestmentTotal();
    if (total === 0) return 0;
    return (this.getInvestmentRecovered() / total) * 100;
  }

  // Registrar amortización
  async recordAmortization(amount, source = 'manual', reference = null) {
    if (amount <= 0) {
      return { success: false, error: 'El monto debe ser positivo' };
    }

    const remaining = this.getInvestmentRemaining();
    const amountToRecord = Math.min(amount, remaining);

    if (amountToRecord <= 0) {
      return { success: false, error: 'La inversión ya está completamente recuperada' };
    }

    try {
      const response = await fetch(apiUrl("/api/accounting/investment/amortization"), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountToRecord,
          source,
          reference,
          date: new Date().toISOString()
        })
      });

      if (response.ok) {
        const data = await response.json();
        this.investment = data.investment;
        return { 
          success: true, 
          amortization: data.amortization,
          investment: data.investment 
        };
      } else {
        const error = await response.json();
        return { success: false, error: error.message };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== REPORTES FINANCIEROS ====================

  async getBalanceSheet() {
    try {
      const response = await fetch('/api/accounting/balance-sheet');
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error obteniendo balance:', error);
    }
    return null;
  }

  async getIncomeStatement(startDate, endDate) {
    try {
      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const response = await fetch(apiUrl(`/api/accounting/income-statement?${params}`));
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error obteniendo estado de resultados:', error);
    }
    return null;
  }

  async getTrialBalance() {
    try {
      const response = await fetch('/api/accounting/trial-balance');
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Error obteniendo balanza:', error);
    }
    return null;
  }

  // Verificar ecuación contable
  async verifyAccountingEquation() {
    try {
      const response = await fetch(apiUrl("/api/accounting/balance-check"));
      if (response.ok) {
        const data = await response.json();
        return {
          activos: data.activos,
          pasivos: data.pasivos,
          capital: data.capital,
          balanced: data.balanced,
          difference: data.diferencia
        };
      }
    } catch (error) {
      console.error('Error verificando ecuación:', error);
    }
    return null;
  }

  // ==================== ASISTENTE IA PARA TRANSACCIONES ====================

  parseTransactionText(text) {
    const lowerText = text.toLowerCase().trim();
    
    // Patrones comunes
    const patterns = [
      // "Pago de luz 500" o "Pagué luz $500"
      {
        regex: /(?:pago|pagué|pague)\s+(?:de\s+)?(.+?)\s+\$?(\d+(?:\.\d{2})?)/i,
        type: 'expense',
        handler: (matches) => ({
          description: `Pago de ${matches[1]}`,
          amount: parseFloat(matches[2]),
          suggestedAccounts: this.suggestAccountsForExpense(matches[1])
        })
      },
      // "Venta de 1500" o "Vendí 1500"
      {
        regex: /(?:venta|vendí|vendi)\s+(?:de\s+)?\$?(\d+(?:\.\d{2})?)/i,
        type: 'income',
        handler: (matches) => ({
          description: 'Venta',
          amount: parseFloat(matches[1]),
          suggestedAccounts: {
            debit: this.getAccountByCode('1101'), // Caja
            credit: this.getAccountByCode('4101') // Ventas
          }
        })
      },
      // "Compré materiales 300" o "Compra de harina 200"
      {
        regex: /(?:compré|compre|compra)\s+(?:de\s+)?(.+?)\s+\$?(\d+(?:\.\d{2})?)/i,
        type: 'purchase',
        handler: (matches) => ({
          description: `Compra de ${matches[1]}`,
          amount: parseFloat(matches[2]),
          suggestedAccounts: {
            debit: this.getAccountByCode('1106'), // Inventario
            credit: this.getAccountByCode('1101') // Caja
          }
        })
      },
      // "Nómina 5000" o "Sueldos 5000"
      {
        regex: /(?:nómina|nomina|sueldos?|salarios?)\s+\$?(\d+(?:\.\d{2})?)/i,
        type: 'payroll',
        handler: (matches) => ({
          description: 'Pago de nómina',
          amount: parseFloat(matches[1]),
          suggestedAccounts: {
            debit: this.getAccountByCode('5101'), // Sueldos
            credit: this.getAccountByCode('1101') // Caja
          }
        })
      },
      // "Renta 3000" o "Pago renta 3000"
      {
        regex: /(?:renta|alquiler)\s+\$?(\d+(?:\.\d{2})?)/i,
        type: 'rent',
        handler: (matches) => ({
          description: 'Pago de renta',
          amount: parseFloat(matches[1]),
          suggestedAccounts: {
            debit: this.getAccountByCode('5102'), // Renta
            credit: this.getAccountByCode('1101') // Caja
          }
        })
      }
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern.regex);
      if (matches) {
        const result = pattern.handler(matches);
        return {
          parsed: true,
          type: pattern.type,
          ...result,
          originalText: text
        };
      }
    }

    return {
      parsed: false,
      originalText: text,
      message: 'No se pudo interpretar. Intenta con: "Pago de [concepto] [monto]" o "Venta [monto]"'
    };
  }

  suggestAccountsForExpense(concept) {
    const conceptLower = concept.toLowerCase();
    
    const mappings = {
      'luz': '5103',
      'agua': '5103',
      'gas': '5103',
      'electricidad': '5103',
      'teléfono': '5104',
      'telefono': '5104',
      'internet': '5104',
      'renta': '5102',
      'alquiler': '5102',
      'publicidad': '5105',
      'marketing': '5105',
      'mantenimiento': '5106',
      'reparación': '5106',
      'reparacion': '5106'
    };

    for (const [keyword, code] of Object.entries(mappings)) {
      if (conceptLower.includes(keyword)) {
        return {
          debit: this.getAccountByCode(code),
          credit: this.getAccountByCode('1101') // Caja
        };
      }
    }

    // Por defecto: Gastos Diversos
    return {
      debit: this.getAccountByCode('5107'),
      credit: this.getAccountByCode('1101')
    };
  }

  // Crear asiento desde sugerencia del asistente
  async createEntryFromSuggestion(suggestion) {
    if (!suggestion.suggestedAccounts) {
      return { success: false, error: 'Sin cuentas sugeridas' };
    }

    const { debit, credit } = suggestion.suggestedAccounts;
    
    if (!debit || !credit) {
      return { success: false, error: 'Cuentas no encontradas' };
    }

    const entryData = {
      description: suggestion.description,
      date: new Date().toISOString().split('T')[0],
      lines: [
        { account_id: debit.id, account_code: debit.code, debit: suggestion.amount, credit: 0 },
        { account_id: credit.id, account_code: credit.code, debit: 0, credit: suggestion.amount }
      ]
    };

    return await this.createJournalEntry(entryData);
  }
}

// Singleton
const accountingCore = new AccountingCore();
export default accountingCore;
