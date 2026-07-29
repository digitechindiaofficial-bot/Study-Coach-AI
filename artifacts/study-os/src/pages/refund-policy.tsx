import LegalLayout, { LegalPage, LegalSection } from "@/components/legal-layout";
import { CheckCircle2, XCircle } from "lucide-react";

export default function RefundPolicyPage() {
  return (
    <LegalLayout>
      <LegalPage title="Refund Policy" subtitle="GovtGuru — Digi Tech India" lastUpdated="July 22, 2026">

        <LegalSection title="1. Subscription Plans">
          <p>
            GovtGuru offers Pro subscriptions at <strong>₹129/month</strong> or <strong>₹999/year</strong>, processed via Razorpay.
          </p>
        </LegalSection>

        <LegalSection title="2. Refund Eligibility">
          <div className="grid sm:grid-cols-2 gap-4 mt-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-4 space-y-2">
              <p className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Eligible for Refund
              </p>
              <ul className="space-y-1 text-sm text-emerald-800 dark:text-emerald-300">
                <li>✅ Request within 7 days of purchase</li>
                <li>✅ Technical issue preventing app usage</li>
                <li>✅ Duplicate payment charged</li>
                <li>✅ Service not as described</li>
              </ul>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-4 space-y-2">
              <p className="font-semibold text-red-700 dark:text-red-400 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" /> Not Eligible for Refund
              </p>
              <ul className="space-y-1 text-sm text-red-800 dark:text-red-300">
                <li>❌ After 7 days of purchase</li>
                <li>❌ Change of mind after usage</li>
                <li>❌ Partial month usage</li>
                <li>❌ Account suspended due to violations</li>
              </ul>
            </div>
          </div>
        </LegalSection>

        <LegalSection title="3. How to Request a Refund">
          <p>
            Email us at:{" "}
            <a href="mailto:digitechindiaofficial@gmail.com?subject=Refund Request" className="text-primary hover:underline">
              digitechindiaofficial@gmail.com
            </a>
          </p>
          <p className="font-medium text-foreground mt-2">Subject: Refund Request — [Your Email]</p>
          <p className="mt-1">Please include:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Your registered email address</li>
            <li>Payment date and amount</li>
            <li>Reason for refund</li>
            <li>Transaction ID from Razorpay</li>
          </ul>
        </LegalSection>

        <LegalSection title="4. Refund Processing">
          <ul className="list-disc list-inside space-y-1">
            <li>We will respond within 2 business days</li>
            <li>Approved refunds processed in 5–7 business days</li>
            <li>Refund goes back to the original payment method</li>
            <li>Your bank may take an additional 3–5 days</li>
          </ul>
        </LegalSection>

        <LegalSection title="5. Cancellation">
          <ul className="list-disc list-inside space-y-1">
            <li>Cancel anytime from the Settings page</li>
            <li>Access continues until end of billing period</li>
            <li>No refund for remaining days after cancellation</li>
            <li>You can resubscribe anytime</li>
          </ul>
        </LegalSection>

        <LegalSection title="6. Contact">
          <p>
            Email:{" "}
            <a href="mailto:digitechindiaofficial@gmail.com" className="text-primary hover:underline">
              digitechindiaofficial@gmail.com
            </a>
          </p>
        </LegalSection>

      </LegalPage>
    </LegalLayout>
  );
}
