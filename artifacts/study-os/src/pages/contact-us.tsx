import { useState } from "react";
import LegalLayout from "@/components/legal-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Clock, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

const SUBJECTS = [
  "Technical Issue",
  "Payment Problem",
  "Wrong Question Report",
  "Feature Request",
  "Account Deletion",
  "Other",
];

const QUICK_HELP = [
  {
    q: "How to upgrade to Pro?",
    a: "Go to Settings → Upgrade to Pro → Pay ₹199/month via Razorpay.",
  },
  {
    q: "I was charged but plan not activated?",
    a: "Email us with your transaction ID. We will activate within 2 hours.",
  },
  {
    q: "How to change target exam?",
    a: "Go to Settings → Target Exam → Select exam → Save Settings.",
  },
  {
    q: "How to delete my account?",
    a: "Email us at digitechindiaofficial@gmail.com. We will delete all your data within 7 days.",
  },
  {
    q: "Found a wrong question?",
    a: "Please email us the question details. We appreciate your feedback!",
  },
];

export default function ContactUsPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim())    e.name    = "Name is required";
    if (!form.email.trim())   e.email   = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.subject)        e.subject = "Please select a subject";
    if (!form.message.trim()) e.message = "Message is required";
    else if (form.message.trim().length < 10) e.message = "Message must be at least 10 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setStatus("loading");
    try {
      const resp = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error((d as any).error ?? "Failed to send message");
      }
      setStatus("success");
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message ?? "Something went wrong. Please try again.");
    }
  };

  return (
    <LegalLayout>
      <div className="space-y-10">
        {/* Header */}
        <div className="space-y-1 pb-6 border-b">
          <h1 className="text-3xl font-bold tracking-tight">Contact Us</h1>
          <p className="text-muted-foreground">We are here to help! 🙏</p>
        </div>

        {/* Info cards */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-5 flex gap-4 items-start">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Support Email</p>
                <a href="mailto:digitechindiaofficial@gmail.com" className="text-primary text-sm hover:underline">
                  digitechindiaofficial@gmail.com
                </a>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex gap-4 items-start">
              <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                <Clock className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">Response Time</p>
                <p className="text-sm text-muted-foreground">Mon–Sat: 10 AM – 6 PM IST</p>
                <p className="text-xs text-muted-foreground">Reply within 24 hours on working days</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick help */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold">Quick Help</h2>
          <div className="space-y-3">
            {QUICK_HELP.map(item => (
              <div key={item.q} className="rounded-lg border bg-muted/30 p-4 space-y-1">
                <p className="font-medium text-sm">Q: {item.q}</p>
                <p className="text-sm text-muted-foreground">A: {item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Contact form */}
        <section className="space-y-5">
          <h2 className="text-xl font-bold">Send us a Message</h2>

          {status === "success" ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="text-lg font-bold text-emerald-700 dark:text-emerald-400">Message Sent!</h3>
              <p className="text-sm text-muted-foreground">
                Thank you for reaching out. We will get back to you within 24 hours.
              </p>
              <Button variant="outline" size="sm" onClick={() => setStatus("idle")}>
                Send Another Message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {/* Name */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Name <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Your name"
                    className={`w-full rounded-md border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-primary/30 ${errors.name ? "border-destructive" : "border-input"}`}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Email <span className="text-destructive">*</span></label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="your@email.com"
                    className={`w-full rounded-md border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-primary/30 ${errors.email ? "border-destructive" : "border-input"}`}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Subject <span className="text-destructive">*</span></label>
                <select
                  value={form.subject}
                  onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className={`w-full rounded-md border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-primary/30 ${errors.subject ? "border-destructive" : "border-input"}`}
                >
                  <option value="">Select a subject...</option>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Message <span className="text-destructive">*</span></label>
                <textarea
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="Describe your issue or question..."
                  rows={5}
                  className={`w-full rounded-md border px-3 py-2 text-sm bg-background outline-none focus:ring-2 focus:ring-primary/30 resize-none ${errors.message ? "border-destructive" : "border-input"}`}
                />
                {errors.message && <p className="text-xs text-destructive">{errors.message}</p>}
              </div>

              {status === "error" && (
                <div className="flex items-center gap-2 text-sm text-destructive p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <Button type="submit" disabled={status === "loading"} className="w-full sm:w-auto px-8">
                {status === "loading" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</>
                ) : (
                  <>Send Message</>
                )}
              </Button>
            </form>
          )}
        </section>
      </div>
    </LegalLayout>
  );
}
