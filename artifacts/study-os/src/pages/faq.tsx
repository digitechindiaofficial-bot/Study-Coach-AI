import { useState } from "react";
import LegalLayout from "@/components/legal-layout";
import { ChevronDown, ChevronUp } from "lucide-react";

interface FAQ {
  q: string;
  a: string;
}

const SECTIONS: Array<{ title: string; faqs: FAQ[] }> = [
  {
    title: "General",
    faqs: [
      {
        q: "What is GovtGuru?",
        a: "GovtGuru is an AI-powered study platform for Indian government exam preparation. We provide personalised study plans, practice questions, and progress tracking.",
      },
      {
        q: "Which exams are covered?",
        a: "Currently we cover BPSC, UPPSC, SSC CGL, SSC CHSL, IBPS PO, IBPS Clerk, SBI PO, SBI Clerk, RRB NTPC, and more. New exams are being added regularly.",
      },
      {
        q: "Is GovtGuru free?",
        a: "Yes! Basic features are free with 10 questions per day. Pro plan at ₹129/month (or ₹999/year) gives unlimited access to all features including AI study planner and detailed analytics.",
      },
    ],
  },
  {
    title: "Account",
    faqs: [
      {
        q: "How do I sign up?",
        a: "Click \"Sign Up\" on the home page. You can sign up with Google or your email address — takes less than 30 seconds.",
      },
      {
        q: "Can I use one account on multiple devices?",
        a: "Yes! Your account syncs across all devices. Progress, study plans, and quiz history are all saved in real-time.",
      },
      {
        q: "How do I delete my account?",
        a: "Email us at digitechindiaofficial@gmail.com with the subject \"Account Deletion Request\". We will delete all your data within 7 days.",
      },
    ],
  },
  {
    title: "Subscription",
    faqs: [
      {
        q: "What is included in the Pro plan?",
        a: "Unlimited questions, AI-powered personalised study planner, detailed progress analytics, weak area drill, full current affairs access, and priority support — all for ₹129/month or ₹999/year.",
      },
      {
        q: "Can I cancel anytime?",
        a: "Yes! Cancel anytime from Settings → Subscription. You keep Pro access until the end of your current billing period.",
      },
      {
        q: "Is my payment information safe?",
        a: "Yes! All payments are processed by Razorpay, a PCI-DSS compliant payment gateway. We never store your card details.",
      },
      {
        q: "Do you offer student discounts?",
        a: "Yes! We offer special discounts for students. Email us at digitechindiaofficial@gmail.com for student discount codes.",
      },
    ],
  },
  {
    title: "Technical",
    faqs: [
      {
        q: "The app is not loading?",
        a: "Try refreshing the page or clearing your browser cache (Ctrl+Shift+R). If the issue persists, email us at digitechindiaofficial@gmail.com.",
      },
      {
        q: "My quiz progress is not saving?",
        a: "Make sure you are signed in. Progress saves automatically after each question is answered. Check your internet connection if you see sync issues.",
      },
      {
        q: "Study plan is showing wrong subjects?",
        a: "Go to Settings and make sure your Target Exam is set correctly. Then click Regenerate on the Study Planner page to generate a fresh plan.",
      },
    ],
  },
];

function FAQItem({ faq }: { faq: FAQ }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-muted/40 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="font-medium text-sm text-foreground">{faq.q}</span>
        {open ? <ChevronUp className="w-4 h-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm text-muted-foreground leading-relaxed border-t bg-muted/10 pt-3">
          {faq.a}
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  return (
    <LegalLayout>
      <div className="space-y-10">
        <div className="space-y-1 pb-6 border-b">
          <h1 className="text-3xl font-bold tracking-tight">Frequently Asked Questions</h1>
          <p className="text-muted-foreground">
            Can't find what you're looking for?{" "}
            <a href="/contact-us" className="text-primary hover:underline">Contact us</a>.
          </p>
        </div>

        {SECTIONS.map(section => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-xl font-bold">{section.title}</h2>
            <div className="space-y-2">
              {section.faqs.map(faq => (
                <FAQItem key={faq.q} faq={faq} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </LegalLayout>
  );
}
