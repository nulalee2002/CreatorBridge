import { RATES, LICENSING_OPTIONS, TURNAROUND_OPTIONS } from '../data/rates.js';
import { DEFAULT_EXCHANGE_RATES, CURRENCIES } from '../data/regions.js';

// Get the rate object for a given service + rate key + region
export function getRate(serviceId, rateKey, regionKey) {
  const servicRates = RATES[serviceId];
  if (!servicRates || !servicRates[rateKey]) return null;
  const rateObj = servicRates[rateKey];
  return rateObj[regionKey] || null;
}

// Get all rates for a region with mid-fill (respects experience level)
export function getRegionRates(serviceId, regionKey, experienceLevel = 'mid') {
  const serviceRates = RATES[serviceId];
  if (!serviceRates) return {};
  const result = {};
  for (const [key, rateObj] of Object.entries(serviceRates)) {
    const range = rateObj[regionKey];
    if (!range) continue;
    let value;
    if (experienceLevel === 'entry') value = range.low;
    else if (experienceLevel === 'senior') value = range.high;
    else value = range.mid;
    result[key] = { ...range, current: value };
  }
  return result;
}

// Convert a USD value to display currency
export function convertCurrency(usdValue, toCurrency, exchangeRates = DEFAULT_EXCHANGE_RATES) {
  if (!usdValue || toCurrency === 'USD') return usdValue;
  const rate = exchangeRates[toCurrency] || 1;
  return Math.round(usdValue * rate);
}

// Convert from any currency back to USD
export function toUSD(value, fromCurrency, exchangeRates = DEFAULT_EXCHANGE_RATES) {
  if (!value || fromCurrency === 'USD') return value;
  const rate = exchangeRates[fromCurrency] || 1;
  return Math.round(value / rate);
}

// Format a number as currency
export function formatCurrency(amount, currency = 'USD', exchangeRates = DEFAULT_EXCHANGE_RATES) {
  const display = convertCurrency(amount, currency, exchangeRates);
  const sym = CURRENCIES[currency]?.symbol || '$';
  if (display >= 1000000) return `${sym}${(display / 1000000).toFixed(1)}M`;
  if (display >= 10000) return `${sym}${(display / 1000).toFixed(1)}k`;
  return `${sym}${display?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) ?? '0'}`;
}

// Determine rate health status
export function getRateHealth(value, range) {
  if (!range || !value) return 'neutral';
  const { low, high, mid } = range;
  const buffer = (high - low) * 0.1;
  if (value < low - buffer) return 'red';
  if (value < low) return 'yellow';
  if (value > high + buffer) return 'blue';
  return 'green';
}

// Calculate rate health score (1–10) for "Am I Charging Enough" widget
export function calculateHealthScore(lineItems, serviceId, regionKey) {
  if (!lineItems || lineItems.length === 0) return null;
  let totalScore = 0;
  let count = 0;
  for (const item of lineItems) {
    if (!item.rateKey || !item.value) continue;
    const range = getRate(serviceId, item.rateKey, regionKey);
    if (!range) continue;
    const { low, mid, high } = range;
    const span = high - low;
    if (span === 0) continue;
    // normalize 0-10: low=3, mid=6, high=10
    const normalized = Math.max(0, Math.min(10, ((item.value - low) / span) * 7 + 3));
    totalScore += normalized;
    count++;
  }
  if (count === 0) return null;
  return Math.round(totalScore / count * 10) / 10;
}

// Build a full quote from calculator state
export function buildQuote(state) {
  const {
    serviceId,
    regionKey,
    lineItems,
    equipment,
    travelFee,
    travelMiles,
    travelMileRate,
    travelType,
    revisions,
    additionalRevisionRate,
    assistants,
    assistantRate,
    locationFee,
    turnaround,
    customTurnaroundPct,
    licensingId,
    taxEnabled,
    taxRate,
    costInputs,
    currency,
    exchangeRates,
  } = state;

  const lines = [];

  // Service line items
  for (const item of lineItems) {
    if (!item.active || !item.quantity || !item.value) continue;
    const subtotal = item.value * item.quantity;
    lines.push({
      id: item.id,
      category: 'service',
      label: item.label,
      rate: item.value,
      quantity: item.quantity,
      unit: item.unit || '',
      subtotal,
    });
  }

  // Equipment
  for (const eq of equipment) {
    if (!eq.active || !eq.price) continue;
    lines.push({
      id: `eq-${eq.id}`,
      category: 'equipment',
      label: eq.label,
      rate: eq.price,
      quantity: eq.days || 1,
      unit: 'day',
      subtotal: eq.price * (eq.days || 1),
    });
  }

  // Travel
  if (travelType === 'mileage' && travelMiles && travelMileRate) {
    lines.push({
      id: 'travel',
      category: 'travel',
      label: 'Travel (mileage)',
      rate: travelMileRate,
      quantity: travelMiles,
      unit: 'mile',
      subtotal: travelMileRate * travelMiles,
    });
  } else if (travelType === 'flat' && travelFee) {
    lines.push({
      id: 'travel',
      category: 'travel',
      label: 'Travel (flat fee)',
      rate: travelFee,
      quantity: 1,
      unit: 'flat',
      subtotal: travelFee,
    });
  }

  // Assistants
  if (assistants && assistantRate) {
    lines.push({
      id: 'assistant',
      category: 'crew',
      label: `Assistant / 2nd Shooter × ${assistants}`,
      rate: assistantRate,
      quantity: assistants,
      unit: 'person/day',
      subtotal: assistantRate * assistants,
    });
  }

  // Location fees
  if (locationFee) {
    lines.push({
      id: 'location',
      category: 'location',
      label: 'Location / Permit Fee',
      rate: locationFee,
      quantity: 1,
      unit: 'flat',
      subtotal: locationFee,
    });
  }

  const servicesSubtotal = lines.reduce((s, l) => s + l.subtotal, 0);

  // Licensing multiplier
  const licensingOption = LICENSING_OPTIONS.find(l => l.id === licensingId) || LICENSING_OPTIONS[0];
  const licensingAdder = servicesSubtotal * (licensingOption.multiplier - 1);
  if (licensingAdder > 0) {
    lines.push({
      id: 'licensing',
      category: 'licensing',
      label: `Licensing: ${licensingOption.label}`,
      rate: null,
      quantity: null,
      unit: null,
      subtotal: licensingAdder,
      note: `${((licensingOption.multiplier - 1) * 100).toFixed(0)}% usage rights premium`,
    });
  }

  const subtotalBeforeRush = lines.reduce((s, l) => s + l.subtotal, 0);

  // Turnaround / rush fee
  const turnaroundOption = TURNAROUND_OPTIONS.find(t => t.id === turnaround);
  let rushMultiplier = 0;
  if (turnaroundOption?.multiplier !== null) {
    rushMultiplier = turnaroundOption?.multiplier || 0;
  } else {
    rushMultiplier = (customTurnaroundPct || 0) / 100;
  }
  const rushAdder = subtotalBeforeRush * rushMultiplier;
  if (rushAdder > 0) {
    lines.push({
      id: 'rush',
      category: 'rush',
      label: `Rush Fee (${(rushMultiplier * 100).toFixed(0)}%)`,
      rate: null,
      quantity: null,
      unit: null,
      subtotal: rushAdder,
    });
  }

  const subtotalPreTax = lines.reduce((s, l) => s + l.subtotal, 0);

  // Tax
  let taxAmount = 0;
  if (taxEnabled && taxRate) {
    taxAmount = subtotalPreTax * (taxRate / 100);
  }

  const grandTotal = subtotalPreTax + taxAmount;

  // Profit margin
  const totalCost = costInputs?.reduce((s, c) => s + (c.value || 0), 0) || 0;
  const profitMargin = grandTotal > 0 ? Math.round(((grandTotal - totalCost) / grandTotal) * 100) : null;
  const grossProfit = grandTotal - totalCost;

  // Additional revisions note
  const revisionsNote = revisions && additionalRevisionRate
    ? `Includes ${revisions} revision${revisions > 1 ? 's' : ''}. Additional revisions: $${additionalRevisionRate} each.`
    : revisions ? `Includes ${revisions} revision${revisions > 1 ? 's' : ''}.` : '';

  return {
    lines,
    servicesSubtotal,
    subtotalPreTax,
    taxAmount,
    taxRate: taxEnabled ? taxRate : 0,
    grandTotal,
    rushMultiplier,
    licensingOption,
    revisionsNote,
    totalCost,
    profitMargin,
    grossProfit,
  };
}
