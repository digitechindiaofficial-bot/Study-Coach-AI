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
    amountINR: 39,
    amountPaise: 3_900,
    display: "₹39/month",
    short: "₹39/mo",
    buttonLabel: "Upgrade to Pro — ₹39/month",
  },
  yearly: {
    amountINR: 348,
    amountPaise: 34_800,
    display: "₹348/year",
    perMonthINR: 29,
    perMonthDisplay: "₹29/month",
    savingsPercent: 26,
    savingsLabel: "Save 26%",
    buttonLabel: "Buy annual Pro → ₹348/year",
    tagline: "or ₹29/month — ₹348 paid upfront annually",
  },
} as const;

/** Shorthand helpers for the most common display strings */
export const MONTHLY_DISPLAY = PRICING.monthly.display;
export const MONTHLY_SHORT = PRICING.monthly.short;
export const YEARLY_DISPLAY = PRICING.yearly.display;
export const YEARLY_TAGLINE = PRICING.yearly.tagline;
export const SAVINGS_LABEL = PRICING.yearly.savingsLabel;
