import LegalLayout, { LegalPage, LegalSection } from "@/components/legal-layout";

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout>
      <LegalPage title="Privacy Policy" subtitle="GovtGuru — Digi Tech India" lastUpdated="July 22, 2026">

        <LegalSection title="1. Introduction">
          <p>
            GovtGuru ("we", "our", "us") is owned and operated by{" "}
            <strong>Digi Tech India</strong> (
            <a href="mailto:digitechindiaofficial@gmail.com" className="text-primary hover:underline">
              digitechindiaofficial@gmail.com
            </a>
            ). This Privacy Policy explains how we collect, use, and protect your personal
            information when you use our app and website.
          </p>
        </LegalSection>

        <LegalSection title="2. Information We Collect">
          <ul className="list-disc list-inside space-y-1">
            <li>Name and email address (via Clerk Auth)</li>
            <li>Mobile number (optional, provided by you)</li>
            <li>Target exam and study preferences</li>
            <li>Quiz attempt history and scores</li>
            <li>Device information and usage data</li>
            <li>Payment information (processed by Razorpay — we do not store card details)</li>
          </ul>
        </LegalSection>

        <LegalSection title="3. How We Use Your Information">
          <ul className="list-disc list-inside space-y-1">
            <li>To provide personalised study plans</li>
            <li>To track your quiz performance</li>
            <li>To send study reminders and notifications</li>
            <li>To process payments for Pro subscription</li>
            <li>To improve our app and services</li>
            <li>To send important updates about your exam</li>
          </ul>
        </LegalSection>

        <LegalSection title="4. Data Storage and Security">
          <ul className="list-disc list-inside space-y-1">
            <li>Your data is stored securely on our PostgreSQL database</li>
            <li>Authentication is handled by Clerk</li>
            <li>We use industry-standard SSL encryption</li>
            <li>We do not sell your data to third parties</li>
            <li>Quiz history is stored to track your progress</li>
          </ul>
        </LegalSection>

        <LegalSection title="5. Third-Party Services We Use">
          <ul className="list-disc list-inside space-y-1">
            <li>Clerk (Authentication)</li>
            <li>PostgreSQL / Supabase (Database)</li>
            <li>Razorpay (Payment Processing)</li>
            <li>Google Gemini AI (Study Plan Generation)</li>
            <li>Google Analytics (App usage analytics)</li>
          </ul>
        </LegalSection>

        <LegalSection title="6. Your Rights">
          <ul className="list-disc list-inside space-y-1">
            <li>Access your personal data anytime</li>
            <li>Delete your account and all data</li>
            <li>Opt out of marketing emails</li>
            <li>Update your profile information</li>
            <li>Export your quiz history</li>
          </ul>
        </LegalSection>

        <LegalSection title="7. Children's Privacy">
          <p>
            GovtGuru is intended for users 13 years and older. We do not knowingly
            collect data from children under 13.
          </p>
        </LegalSection>

        <LegalSection title="8. Cookies">
          <p>
            We use cookies to maintain your login session and improve user experience.
            You can disable cookies in your browser settings.
          </p>
        </LegalSection>

        <LegalSection title="9. Changes to Privacy Policy">
          <p>
            We will notify you of any changes via email or app notification.
          </p>
        </LegalSection>

        <LegalSection title="10. Contact Us">
          <p>For privacy concerns, contact:</p>
          <p>
            Email:{" "}
            <a href="mailto:digitechindiaofficial@gmail.com" className="text-primary hover:underline">
              digitechindiaofficial@gmail.com
            </a>
          </p>
          <p>Address: India</p>
        </LegalSection>

      </LegalPage>
    </LegalLayout>
  );
}
