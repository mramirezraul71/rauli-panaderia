import { useEffect, useState } from "react";
import { getBusinessConfig, setBusinessConfig } from "../config/businessConfig";

export default function ActiveCurrencySelector({ className = "" }) {
  const [activeCurrency, setActiveCurrency] = useState(
    getBusinessConfig().activeCurrency || getBusinessConfig().currency
  );
  const businessConfig = getBusinessConfig();
  const currencyOptions = [businessConfig.currency, businessConfig.secondaryCurrency].filter(Boolean);

  useEffect(() => {
    if (!currencyOptions.includes(activeCurrency)) {
      const next = currencyOptions[0] || businessConfig.currency;
      setActiveCurrency(next);
      setBusinessConfig({ activeCurrency: next });
    }
  }, [activeCurrency, currencyOptions, businessConfig.currency]);

  if (currencyOptions.length <= 1) return null;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label className="text-xs text-slate-400">Moneda activa</label>
      <select
        value={activeCurrency}
        onChange={(e) => {
          const next = e.target.value;
          setActiveCurrency(next);
          setBusinessConfig({ activeCurrency: next });
        }}
        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
      >
        {currencyOptions.map((curr) => (
          <option key={curr} value={curr}>{curr}</option>
        ))}
      </select>
    </div>
  );
}
