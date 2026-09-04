import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { isPreviewEnvironment, useAppAuth } from "@/lib/app-auth";
import { savePreviewProfile } from "@/lib/preview-data";

declare global {
  interface Window {
    Razorpay: any;
  }
}

/** Dynamically inject the Razorpay checkout script if not already loaded. */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const existing = document.querySelector('script[src*="razorpay"]');
    if (existing) existing.remove();

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) {
        resolve();
      } else {
        reject(new Error("Razorpay SDK loaded but window.Razorpay not found"));
      }
    };
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK. Check internet connection."));
    document.head.appendChild(script);
  });
}

interface PaymentButtonProps {
  billingPeriod?: "monthly" | "yearly";
  userName?: string;
  userEmail?: string;
  onSuccess?: () => void;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
}

export function PaymentButton({
  billingPeriod = "monthly",
  userName,
  userEmail,
  onSuccess,
  className,
  size = "default",
}: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { getToken } = useAppAuth();
  const preview = isPreviewEnvironment();

  const label = preview
    ? "Preview Pro features"
    : billingPeriod === "yearly"
      ? "Upgrade to Pro → ₹999/year"
      : "Upgrade to Pro →";

  const handlePayment = async () => {
    setLoading(true);
    try {
      if (preview) {
        savePreviewProfile({ planType: "pro" });
        toast({
          title: "Pro preview enabled",
          description: "No payment was charged. Real Razorpay checkout is available after signing in on govtguru.com.",
        });
        onSuccess?.();
        setTimeout(() => window.location.reload(), 500);
        return;
      }

      const orderToken = await getToken();
      if (!orderToken) {
        throw new Error("Your sign-in session has expired. Please sign in again.");
      }

      await loadRazorpayScript();

      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${orderToken}`,
        },
        credentials: "include",
        body: JSON.stringify({ billingPeriod }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        throw new Error(err.error || `Order creation failed (${orderRes.status})`);
      }

      const { order_id, amount, currency, key_id } = await orderRes.json();

      const description = billingPeriod === "yearly"
        ? "Pro Plan — 1 Year (₹999)"
        : "Pro Plan — 1 Month (₹129)";

      const options = {
        key: key_id,
        amount,
        currency,
        name: "GovtGuru",
        description,
        image: "/logo-icon.png",
        order_id,
        theme: { color: "#1B2A4A" },
        prefill: {
          name: userName ?? "",
          email: userEmail ?? "",
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const verifyToken = await getToken();
            if (!verifyToken) {
              throw new Error("Your sign-in session has expired.");
            }

            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${verifyToken}`,
              },
              credentials: "include",
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (!verifyRes.ok) {
              throw new Error("Payment verification failed on server");
            }

            toast({
              title: "🎉 Welcome to Pro!",
              description: "Your plan is now active. Enjoy unlimited features!",
            });

            onSuccess?.();
            setTimeout(() => window.location.reload(), 1500);
          } catch {
            toast({
              title: "Verification failed",
              description: "Payment received but verification failed. Please contact support.",
              variant: "destructive",
            });
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (resp: any) => {
        toast({
          title: "Payment failed",
          description: resp?.error?.description || "Payment could not be processed. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
      });
      rzp.open();

    } catch (err: any) {
      toast({
        title: "Could not open payment",
        description: err?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePayment}
      disabled={loading}
      size={size}
      className={`bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-sm font-semibold ${className ?? ""}`}
    >
      {loading ? (
        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="mr-2 w-4 h-4" />
      )}
      {loading ? "Opening checkout…" : label}
    </Button>
  );
}
