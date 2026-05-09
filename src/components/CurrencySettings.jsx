import { useState } from 'react';
import { DollarSign, ChevronDown } from 'lucide-react';
import { CURRENCIES, DEFAULT_EXCHANGE_RATES } from '../data/regions.js';

export function CurrencySettings({ currency, exchangeRates, onCurrencyChange, onRatesChange, dark = true }) {
  const [open, setOpen] = useState(false);
  const bg = dark ? 'bg-charcoal-900/72 border-white/[0.08]' : 'bg-white border-gray-200';
  const dropBg = dark ? 'bg-charcoal-950/96 border-white/[0.09] shadow-[0_24px_80px_rgba(0,0,0,0.36)]' : 'bg-white border-gray-200';
  const inputCls = dark
    ? 'bg-charcoal-950/70 border-white/[0.09] text-white focus:border-gold-500'
    : 'bg-white border-gray-300 text-gray-900 focus:border-gold-500';
  const textMain = dark ? 'text-white' : 'text-gray-900';
  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';

  const rates = exchangeRates || DEFAULT_EXCHANGE_RATES;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${bg} ${textMain} text-sm transition-all hover:border-gold-500/40`}
      >
        <DollarSign size={14} className="text-gold-400" />
        <span className="font-medium">{currency}</span>
        <ChevronDown size={12} className={`${textSub} transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className={`absolute right-0 top-full mt-2 z-40 w-72 rounded-2xl border shadow-2xl ${dropBg} overflow-hidden animate-slide-up`}>
            {/* Currency selector */}
            <div className={`px-4 py-3 border-b ${dark ? 'border-white/[0.07]' : 'border-gray-100'}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Display Currency</p>
              <div className="grid grid-cols-4 gap-1">
                {Object.entries(CURRENCIES).map(([code, info]) => (
                  <button
                    key={code}
                    type="button"
                    onClick={() => onCurrencyChange(code)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                      currency === code
                        ? 'bg-gold-500 text-charcoal-900'
                        : dark ? 'bg-white/[0.08] text-charcoal-300 hover:bg-white/[0.12]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {info.symbol} {code}
                  </button>
                ))}
              </div>
            </div>

            {/* Exchange rates */}
            <div className="px-4 py-3">
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${textSub}`}>Exchange Rates (per 1 USD)</p>
              <div className="space-y-2">
                {Object.entries(rates).filter(([c]) => c !== 'USD').map(([code, rate]) => (
                  <div key={code} className="flex items-center gap-2">
                    <span className={`text-xs font-medium w-10 ${textMain}`}>{code}</span>
                    <input
                      type="number"
                      step="0.01"
                      value={rate}
                      onChange={e => onRatesChange({ ...rates, [code]: parseFloat(e.target.value) || rate })}
                      className={`flex-1 px-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputCls}`}
                    />
                    <button
                      type="button"
                      onClick={() => onRatesChange({ ...rates, [code]: DEFAULT_EXCHANGE_RATES[code] })}
                      className={`text-[10px] ${textSub} hover:text-gold-400 transition-colors`}
                    >
                      Reset
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
