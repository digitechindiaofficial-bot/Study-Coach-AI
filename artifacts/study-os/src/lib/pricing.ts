/**
 * Single source of truth for GovtGuru Pro pricing.
 *
 * Update values HERE only — every component, page, and legal text
 * that references pricing imports from this file.
 *
 * Backend paise amounts live in artifacts/api-server/src/routes/payment.ts
 * and must be kept in sync manually when prices change.
 */

export const PRICING = {
  monthly: {
    amountINR: 129,
    amountPaise: 12_900,
    display: "₹129/month",
    short: "₹129/mo",
    buttonLabel: "Upgrade to Pro — ₹129/month",
  },
  yearly: {
    amountINR: 999,
    amountPaise: 99_900,
    display: "₹999/year",
    perMonthINR: 83,
    perMonthDisplay: "₹83/month",
    savingsPercent: 36,
    savingsLabel: "Save 36%",
    buttonLabel: "Upgrade to Pro → ₹999/year",
    tagline: "or ₹999/year — save 36%",
  },
} as const;

/** Shorthand helpers for the most common display strings */
export const MONTHLY_DISPLAY  = PRICING.monthly.display;       // "₹129/month"
export const MONTHLY_SHORT    = PRICING.monthly.short;          // "₹129/mo"
export const YEARLY_DISPLAY   = PRICING.yearly.display;         // "₹999/year"
export const YEARLY_TAGLINE   = PRICING.yearly.tagline;         // "or ₹999/year — save 36%"
export const SAVINGS_LABEL    = PRICING.yearly.savingsLabel;    // "Save 36%"
