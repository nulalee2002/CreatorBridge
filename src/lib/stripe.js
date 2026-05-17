import { loadStripe } from '@stripe/stripe-js';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export const stripeConfigured = !!(stripePublishableKey && stripePublishableKey !== 'pk_test_PASTE_YOUR_FULL_KEY_HERE');

let stripePromise = null;

export function getStripe() {
  if (!stripeConfigured) return null;
  if (!stripePromise) {
    stripePromise = loadStripe(stripePublishableKey);
  }
  return stripePromise;
}
