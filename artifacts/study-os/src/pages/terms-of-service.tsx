import LegalLayout, { LegalPage, LegalSection } from "@/components/legal-layout";

export default function TermsOfServicePage() {
  return (
    <LegalLayout>
      <LegalPage title="Terms of Service" subtitle="GovtGuru — Digi Tech India" lastUpdated="July 22, 2026">

        <LegalSection title="1. Acceptance of Terms">
          <p>
            By using GovtGuru, you agree to these Terms of Service. If you do not agree,
            please do not use our service.
          </p>
        </LegalSection>

        <LegalSection title="2. Description of Service">
          <p>GovtGuru provides:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>AI-powered study plans for govt exams</li>
            <li>Quiz practice with 4000+ questions</li>
            <li>Progress tracking and weak area analysis</li>
            <li>Current affairs updates</li>
            <li>Available on web and mobile platforms</li>
          </ul>
        </LegalSection>

        <LegalSection title="3. User Accounts">
          <ul className="list-disc list-inside space-y-1">
            <li>You must provide accurate information</li>
            <li>You are responsible for account security</li>
            <li>One account per person only</li>
            <li>Do not share your account credentials</li>
            <li>We reserve the right to suspend accounts that violate these terms</li>
          </ul>
        </LegalSection>

        <LegalSection title="4. Free and Pro Plans">
          <div className="space-y-3">
            <div className="rounded-lg border p-4 space-y-1.5">
              <p className="font-semibold text-foreground">Free Plan</p>
              <ul className="list-disc list-inside space-y-1">
                <li>10 questions per day</li>
                <li>Basic study planner</li>
                <li>Access to syllabus</li>
                <li>Limited current affairs</li>
              </ul>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-1.5">
              <p className="font-semibold text-foreground">Pro Plan — ₹129/month or ₹999/year</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Unlimited questions</li>
                <li>AI-powered personalised study plan</li>
                <li>Detailed progress analytics</li>
                <li>Weak area drill</li>
                <li>Priority support</li>
                <li>Full current affairs access</li>
              </ul>
            </div>
          </div>
        </LegalSection>

        <LegalSection title="5. Prohibited Activities">
          <p>You must NOT:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Copy or redistribute our question bank</li>
            <li>Use bots or automated tools</li>
            <li>Share your account with others</li>
            <li>Attempt to hack or disrupt the service</li>
            <li>Use the app for commercial purposes</li>
            <li>Post inappropriate content</li>
          </ul>
        </LegalSection>

        <LegalSection title="6. Intellectual Property">
          <p>
            All content on GovtGuru including questions, study plans, and materials are
            owned by Digi Tech India. You may not reproduce or distribute any content
            without permission.
          </p>
        </LegalSection>

        <LegalSection title="7. Disclaimer">
          <ul className="list-disc list-inside space-y-1">
            <li>Questions are for practice purposes only</li>
            <li>We do not guarantee exam success</li>
            <li>Content accuracy is maintained but we are not responsible for errors</li>
            <li>Study plans are AI-generated suggestions</li>
          </ul>
        </LegalSection>

        <LegalSection title="8. Limitation of Liability">
          <p>GovtGuru shall not be liable for:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Exam failures or poor performance</li>
            <li>Data loss due to technical issues</li>
            <li>Third-party service interruptions</li>
            <li>Indirect or consequential damages</li>
          </ul>
        </LegalSection>

        <LegalSection title="9. Termination">
          <p>We may terminate your account if you:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Violate these terms</li>
            <li>Engage in fraudulent activity</li>
            <li>Abuse the platform or other users</li>
          </ul>
        </LegalSection>

        <LegalSection title="10. Governing Law">
          <p>
            These terms are governed by the laws of India. Disputes shall be resolved in
            courts of India.
          </p>
        </LegalSection>

        <LegalSection title="11. Contact">
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
