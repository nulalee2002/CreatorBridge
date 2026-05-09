import { RateHealthBadge } from './RateHealthBadge.jsx';

export function CurrencyInput({
  label,
  value,
  onChange,
  range,
  unit,
  tooltip,
  dark = true,
  currencySymbol = '$',
  min = 0,
  placeholder = '0',
  className = '',
}) {
  const inputCls = dark
    ? 'bg-charcoal-950/70 border-white/[0.09] text-white placeholder-charcoal-500 focus:border-gold-500 focus:ring-1 focus:ring-gold-500/40'
    : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-gold-500 focus:ring-1 focus:ring-gold-500/40';

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className={`text-xs font-medium ${dark ? 'text-charcoal-300' : 'text-gray-500'}`}>
            {label}
            {unit && <span className={`ml-1 ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>/ {unit}</span>}
          </label>
          {range && <RateHealthBadge value={value} range={range} showLabel />}
        </div>
      )}
      <div className="relative flex items-center">
        <span className={`absolute left-2.5 text-xs font-medium pointer-events-none ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>
          {currencySymbol}
        </span>
        <input
          type="number"
          min={min}
          value={value || ''}
          placeholder={placeholder}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className={`w-full pl-6 pr-2 py-2 text-sm rounded-lg border outline-none transition-all ${inputCls}`}
        />
      </div>
      {range && (
        <div className={`flex justify-between text-[10px] ${dark ? 'text-charcoal-300' : 'text-gray-400'}`}>
          <span>Low: {currencySymbol}{range.low?.toLocaleString()}</span>
          <span>Mid: {currencySymbol}{range.mid?.toLocaleString()}</span>
          <span>High: {currencySymbol}{range.high?.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
