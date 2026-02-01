/**
 * GENESIS - Charts Module
 * Componentes de visualización financiera con Recharts
 */

import { useState, useEffect } from 'react';
import { formatCurrency } from '../config/businessConfig';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart
} from 'recharts';

// ==================== COLORES ====================

const COLORS = {
  primary: '#8b5cf6',    // Purple
  secondary: '#06b6d4',  // Cyan
  success: '#10b981',    // Green
  warning: '#f59e0b',    // Amber
  danger: '#ef4444',     // Red
  info: '#3b82f6',       // Blue
  muted: '#64748b',      // Slate
};

const PIE_COLORS = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#ec4899', '#14b8a6'];

// ==================== FORMATTERS ====================

const formatNumber = (value) => {
  return new Intl.NumberFormat('es-MX').format(value || 0);
};

const formatPercent = (value) => {
  return `${(value || 0).toFixed(1)}%`;
};

// ==================== TOOLTIP PERSONALIZADO ====================

const CustomTooltip = ({ active, payload, label, formatter = formatCurrency }) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl">
      <p className="text-slate-300 text-sm mb-2">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatter(entry.value)}
        </p>
      ))}
    </div>
  );
};

// ==================== GRÁFICO DE INGRESOS VS GASTOS ====================

export function IncomeExpenseChart({ data = [], height = 300 }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No hay datos disponibles
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis 
          dataKey="month" 
          stroke="#94a3b8" 
          tick={{ fill: '#94a3b8', fontSize: 12 }}
        />
        <YAxis 
          stroke="#94a3b8" 
          tick={{ fill: '#94a3b8', fontSize: 12 }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ paddingTop: '20px' }}
          formatter={(value) => <span className="text-slate-300">{value}</span>}
        />
        <Area 
          type="monotone" 
          dataKey="ingresos" 
          name="Ingresos"
          fill={COLORS.success} 
          fillOpacity={0.2}
          stroke={COLORS.success}
          strokeWidth={2}
        />
        <Area 
          type="monotone" 
          dataKey="gastos" 
          name="Gastos"
          fill={COLORS.danger} 
          fillOpacity={0.2}
          stroke={COLORS.danger}
          strokeWidth={2}
        />
        <Line 
          type="monotone" 
          dataKey="utilidad" 
          name="Utilidad"
          stroke={COLORS.primary}
          strokeWidth={3}
          dot={{ fill: COLORS.primary, strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ==================== GRÁFICO DE DISTRIBUCIÓN DE GASTOS ====================

export function ExpenseDistributionChart({ data = [], height = 300 }) {
  const [activeIndex, setActiveIndex] = useState(null);

  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No hay datos disponibles
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);

  return (
    <div className="flex flex-col lg:flex-row items-center gap-4">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={PIE_COLORS[index % PIE_COLORS.length]}
                stroke={activeIndex === index ? '#fff' : 'transparent'}
                strokeWidth={activeIndex === index ? 2 : 0}
                style={{
                  filter: activeIndex === index ? 'brightness(1.2)' : 'none',
                  cursor: 'pointer'
                }}
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value) => [formatCurrency(value), 'Monto']}
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #475569',
              borderRadius: '8px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Leyenda */}
      <div className="w-full lg:w-64 space-y-2">
        {data.map((entry, index) => {
          const percentage = total > 0 ? ((entry.value / total) * 100) : 0;
          return (
            <div 
              key={index} 
              className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                activeIndex === index ? 'bg-slate-700' : 'hover:bg-slate-700/50'
              }`}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                />
                <span className="text-sm text-slate-300 truncate max-w-[120px]">
                  {entry.name}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm text-white font-medium">
                  {formatPercent(percentage)}
                </p>
                <p className="text-xs text-slate-400">
                  {formatCurrency(entry.value)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ==================== GRÁFICO DE VENTAS DIARIAS ====================

export function DailySalesChart({ data = [], height = 250 }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        No hay datos disponibles
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
        <XAxis 
          dataKey="day" 
          stroke="#94a3b8" 
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
        />
        <YAxis 
          stroke="#94a3b8" 
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar 
          dataKey="ventas" 
          name="Ventas"
          fill={COLORS.primary}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ==================== GRÁFICO DE PUNTO DE EQUILIBRIO ====================

export function BreakEvenChart({ 
  fixedCosts = 0, 
  variableCostPerUnit = 0, 
  pricePerUnit = 0,
  currentUnits = 0,
  height = 300 
}) {
  // Calcular punto de equilibrio
  const breakEvenUnits = pricePerUnit > variableCostPerUnit 
    ? fixedCosts / (pricePerUnit - variableCostPerUnit) 
    : 0;
  
  const maxUnits = Math.max(breakEvenUnits * 1.5, currentUnits * 1.2, 100);
  
  // Generar datos para el gráfico
  const data = [];
  const steps = 10;
  for (let i = 0; i <= steps; i++) {
    const units = (maxUnits / steps) * i;
    data.push({
      units: Math.round(units),
      costoTotal: fixedCosts + (variableCostPerUnit * units),
      ingresos: pricePerUnit * units,
      costoFijo: fixedCosts
    });
  }

  // Agregar punto actual si no está
  if (currentUnits > 0) {
    const existingPoint = data.find(d => d.units === currentUnits);
    if (!existingPoint) {
      data.push({
        units: currentUnits,
        costoTotal: fixedCosts + (variableCostPerUnit * currentUnits),
        ingresos: pricePerUnit * currentUnits,
        costoFijo: fixedCosts,
        isCurrentPoint: true
      });
      data.sort((a, b) => a.units - b.units);
    }
  }

  const isAboveBreakEven = currentUnits >= breakEvenUnits;

  return (
    <div className="space-y-4">
      {/* Info del punto de equilibrio */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-700/30 rounded-lg p-3">
          <p className="text-xs text-slate-400">Punto de Equilibrio</p>
          <p className="text-lg font-bold text-white">{formatNumber(Math.round(breakEvenUnits))} uds</p>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-3">
          <p className="text-xs text-slate-400">Ventas Necesarias</p>
          <p className="text-lg font-bold text-white">{formatCurrency(breakEvenUnits * pricePerUnit)}</p>
        </div>
        <div className="bg-slate-700/30 rounded-lg p-3">
          <p className="text-xs text-slate-400">Unidades Actuales</p>
          <p className="text-lg font-bold text-white">{formatNumber(currentUnits)} uds</p>
        </div>
        <div className={`rounded-lg p-3 ${isAboveBreakEven ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
          <p className="text-xs text-slate-400">Estado</p>
          <p className={`text-lg font-bold ${isAboveBreakEven ? 'text-green-400' : 'text-red-400'}`}>
            {isAboveBreakEven ? '✓ Rentable' : '✗ Pérdida'}
          </p>
        </div>
      </div>

      {/* Gráfico */}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis 
            dataKey="units" 
            stroke="#94a3b8" 
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            label={{ value: 'Unidades', position: 'insideBottom', offset: -5, fill: '#94a3b8' }}
          />
          <YAxis 
            stroke="#94a3b8" 
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Línea de costos fijos */}
          <Line 
            type="monotone" 
            dataKey="costoFijo" 
            name="Costos Fijos"
            stroke={COLORS.muted}
            strokeDasharray="5 5"
            strokeWidth={1}
            dot={false}
          />
          
          {/* Línea de costos totales */}
          <Line 
            type="monotone" 
            dataKey="costoTotal" 
            name="Costos Totales"
            stroke={COLORS.danger}
            strokeWidth={2}
            dot={false}
          />
          
          {/* Línea de ingresos */}
          <Line 
            type="monotone" 
            dataKey="ingresos" 
            name="Ingresos"
            stroke={COLORS.success}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ==================== BARRA DE PROGRESO DE INVERSIÓN ====================

export function InvestmentProgressBar({ 
  totalInvestment = 0, 
  recoveredAmount = 0, 
  targetDate = null,
  showDetails = true 
}) {
  const remaining = totalInvestment - recoveredAmount;
  const progress = totalInvestment > 0 ? (recoveredAmount / totalInvestment) * 100 : 0;
  
  // Calcular días restantes estimados
  let estimatedDaysRemaining = null;
  if (targetDate) {
    const target = new Date(targetDate);
    const today = new Date();
    const daysToTarget = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    estimatedDaysRemaining = daysToTarget > 0 ? daysToTarget : 0;
  }

  const getProgressColor = () => {
    if (progress >= 100) return 'from-green-500 to-emerald-400';
    if (progress >= 75) return 'from-blue-500 to-cyan-400';
    if (progress >= 50) return 'from-purple-500 to-violet-400';
    if (progress >= 25) return 'from-yellow-500 to-amber-400';
    return 'from-red-500 to-orange-400';
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Recuperación de Inversión</h3>
        <span className={`text-2xl font-bold ${progress >= 100 ? 'text-green-400' : 'text-purple-400'}`}>
          {progress.toFixed(1)}%
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="relative h-8 bg-slate-700 rounded-full overflow-hidden mb-4">
        <div 
          className={`absolute inset-y-0 left-0 bg-gradient-to-r ${getProgressColor()} transition-all duration-500`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />
        {/* Marcadores */}
        <div className="absolute inset-0 flex items-center justify-between px-2">
          <span className="text-xs font-medium text-white drop-shadow">0%</span>
          <span className="text-xs font-medium text-white drop-shadow">50%</span>
          <span className="text-xs font-medium text-white drop-shadow">100%</span>
        </div>
      </div>

      {showDetails && (
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-slate-700/30 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Inversión Total</p>
            <p className="text-lg font-bold text-white">{formatCurrency(totalInvestment)}</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Recuperado</p>
            <p className="text-lg font-bold text-green-400">{formatCurrency(recoveredAmount)}</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-1">Faltante</p>
            <p className="text-lg font-bold text-amber-400">{formatCurrency(remaining)}</p>
          </div>
        </div>
      )}

      {estimatedDaysRemaining !== null && (
        <div className="mt-4 text-center text-sm text-slate-400">
          {estimatedDaysRemaining > 0 
            ? `Estimado: ${estimatedDaysRemaining} días para completar`
            : progress >= 100 
              ? '🎉 ¡Inversión completamente recuperada!'
              : 'Fecha objetivo vencida'
          }
        </div>
      )}
    </div>
  );
}

// ==================== MINI SPARKLINE ====================

export function Sparkline({ data = [], color = COLORS.primary, height = 40 }) {
  if (!data.length) return null;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line 
          type="monotone" 
          dataKey="value" 
          stroke={color}
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ==================== GRÁFICO DE TENDENCIA CON PROYECCIÓN ====================

export function TrendProjectionChart({ 
  historicalData = [], 
  projectionData = [],
  height = 300 
}) {
  // Combinar datos históricos y proyección
  const combinedData = [
    ...historicalData.map(d => ({ ...d, type: 'historical' })),
    ...projectionData.map(d => ({ ...d, type: 'projection' }))
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={combinedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
        <defs>
          <linearGradient id="historicalGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="projectionGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.3}/>
            <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis 
          dataKey="period" 
          stroke="#94a3b8" 
          tick={{ fill: '#94a3b8', fontSize: 11 }}
        />
        <YAxis 
          stroke="#94a3b8" 
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend />
        <Area 
          type="monotone" 
          dataKey="historical" 
          name="Histórico"
          stroke={COLORS.primary}
          fillOpacity={1}
          fill="url(#historicalGradient)"
          strokeWidth={2}
        />
        <Area 
          type="monotone" 
          dataKey="projection" 
          name="Proyección"
          stroke={COLORS.secondary}
          strokeDasharray="5 5"
          fillOpacity={1}
          fill="url(#projectionGradient)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ==================== EXPORTAR TODO ====================

export default {
  IncomeExpenseChart,
  ExpenseDistributionChart,
  DailySalesChart,
  BreakEvenChart,
  InvestmentProgressBar,
  Sparkline,
  TrendProjectionChart,
  COLORS
};
