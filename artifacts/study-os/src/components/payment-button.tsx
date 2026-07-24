import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    // Remove any stale failed script tags first
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
  userName?: string;
  userEmail?: string;
  onSuccess?: () => void;
}

export function PaymentButton({ userName, userEmail, onSuccess }: PaymentButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Step 1: Ensure Razorpay SDK is loaded
      await loadRazorpayScript();

      // Step 2: Create Razorpay order via backend
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!orderRes.ok) {
        const err = await orderRes.json().catch(() => ({}));
        throw new Error(err.error || `Order creation failed (${orderRes.status})`);
      }

      const { order_id, amount, currency } = await orderRes.json();

      // Step 3: Open Razorpay checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount,
        currency,
        name: "GovtGuru",
        description: "Pro Plan — 1 Month",
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
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
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
      className="bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-sm"
    >
      {loading ? (
        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
      ) : (
        <Sparkles className="mr-2 w-4 h-4" />
      )}
      {loading ? "Opening checkout…" : "Upgrade to Pro — ₹199/month"}
    </Button>
  );
}
