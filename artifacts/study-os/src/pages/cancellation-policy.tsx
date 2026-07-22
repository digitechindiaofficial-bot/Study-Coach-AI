import LegalLayout, { LegalPage, LegalSection } from "@/components/legal-layout";

export default function CancellationPolicyPage() {
  return (
    <LegalLayout>
      <LegalPage title="Cancellation Policy" subtitle="GovtGuru — Digi Tech India" lastUpdated="July 22, 2026">

        <LegalSection title="1. How to Cancel">
          <p>
            <strong>Via the app:</strong> Go to Settings → Subscription → Cancel Subscription
          </p>
          <p className="mt-2">
            <strong>Via email:</strong>{" "}
            <a href="mailto:digitechindiaofficial@gmail.com?subject=Cancel Subscription" className="text-primary hover:underline">
              digitechindiaofficial@gmail.com
            </a>
          </p>
        </LegalSection>

        <LegalSection title="2. What Happens After Cancellation">
          <ul className="list-disc list-inside space-y-1">
            <li>Your Pro access continues until end of the current billing period</li>
            <li>After that, your account moves to the Free plan</li>
            <li>Your data and progress is saved — nothing is deleted</li>
            <li>You can resubscribe anytime</li>
          </ul>
        </LegalSection>

        <LegalSection title="3. Cancellation Deadline">
          <p>
            Cancel at least <strong>24 hours before</strong> your next billing date to avoid
            being charged for the next month.
          </p>
        </LegalSection>

        <LegalSection title="4. Reactivation">
          <p>
            You can resubscribe anytime from{" "}
            <strong>Settings → Upgrade to Pro</strong>. Your previous progress and study
            history will be intact.
          </p>
        </LegalSection>

        <LegalSection title="5. Contact">
          <p>
            For cancellation help, email us:{" "}
            <a href="mailto:digitechindiaofficial@gmail.com" className="text-primary hover:underline">
              digitechindiaofficial@gmail.com
            </a>
          </p>
        </LegalSection>

      </LegalPage>
    </LegalLayout>
  );
}
