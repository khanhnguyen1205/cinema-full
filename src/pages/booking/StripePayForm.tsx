import { useImperativeHandle, useMemo, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import type { IntentResult } from "services/payments";

export type PayHandle = { pay: () => Promise<void> };

type Props = {
  publishableKey: string;
  amount: number;
  handleRef: MutableRefObject<PayHandle | null>; // đúng kiểu useRef trả về
  createIntent: () => Promise<IntentResult>;
  onPaid: (paymentRef: string) => Promise<void>;
  onError: (message: string) => void;
};

function InnerForm({
  handleRef,
  createIntent,
  onPaid,
  onError,
}: Omit<Props, "publishableKey" | "amount">) {
  const stripe = useStripe();
  const elements = useElements();
  const { t } = useTranslation();

  // Nút bấm duy nhất vẫn là .os-k__cta của OrderSummary -> wizard gọi qua ref này.
  useImperativeHandle(
    handleRef,
    () => ({
      pay: async () => {
        if (!stripe || !elements) return;
        const submit = await elements.submit();
        if (submit.error) {
          onError(submit.error.message || t("booking.payFailed"));
          return;
        }
        // PaymentIntent chỉ sinh ra ở đây -> bỏ dở giữa chừng không để lại rác.
        const { clientSecret } = await createIntent();
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          clientSecret,
          redirect: "if_required", // ở lại trang -> hold ghế + đồng hồ còn nguyên
        });
        if (error) {
          onError(error.message || t("booking.payDeclined"));
          return;
        }
        if (paymentIntent?.status !== "succeeded") {
          onError(t("booking.payIncomplete"));
          return;
        }
        await onPaid(paymentIntent.id);
      },
    }),
    [stripe, elements, createIntent, onPaid, onError, t],
  );

  return <PaymentElement />;
}

export default function StripePayForm({
  publishableKey,
  amount,
  handleRef,
  createIntent,
  onPaid,
  onError,
}: Props) {
  const { i18n, t } = useTranslation();
  const stripePromise = useMemo(
    () => loadStripe(publishableKey),
    [publishableKey],
  );

  return (
    <div className="pay-k__stripe">
      <Elements
        stripe={stripePromise}
        options={{
          mode: "payment",
          amount,
          currency: "vnd",
          // Khớp payment_method_types của PaymentIntent phía server: chỉ thẻ,
          // để confirmPayment không bao giờ cần return_url / chuyển hướng.
          paymentMethodTypes: ["card"],
          locale: i18n.language === "en" ? "en" : "vi",
          appearance: {
            theme: "night",
            variables: {
              colorPrimary: "#e63030",
              colorBackground: "#161616",
              colorText: "#f0f0f0",
              borderRadius: "0px",
              fontFamily: "'IBM Plex Mono', monospace",
            },
          },
        }}
      >
        <InnerForm
          handleRef={handleRef}
          createIntent={createIntent}
          onPaid={onPaid}
          onError={onError}
        />
      </Elements>
      <p className="pay-k__testcard">{t("booking.payTestCard")}</p>
    </div>
  );
}
