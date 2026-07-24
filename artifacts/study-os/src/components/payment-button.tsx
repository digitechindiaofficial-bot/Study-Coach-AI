import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

declare global {
  interface Window {
    Razorpay: any;
  }
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
      // 1. Create Razorpay order
      const orderRes = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!orderRes.ok) {
        throw new Error("Failed to create order");
      }

      const { order_id, amount, currency } = await orderRes.json();

      // 2. Open Razorpay checkout
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
            // 3. Verify payment on server
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
              throw new Error("Payment verification failed");
            }

            toast({
              title: "🎉 Welcome to Pro!",
              description: "Your plan is now active. Enjoy unlimited features!",
            });

            onSuccess?.();
            // Reload to reflect pro status everywhere
            setTimeout(() => window.location.reload(), 1500);
          } catch {
            toast({
              title: "Verification failed",
              description: "Payment was received but verification failed. Contact support.",
              variant: "destructive",
            });
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
          },
        },
      };

      if (!window.Razorpay) {
        throw new Error("Razorpay SDK not loaded");
      }

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        toast({
          title: "Payment failed",
          description: "Your payment could not be processed. Please try again.",
          variant: "destructive",
        });
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: "Could not initiate payment. Please try again.",
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
