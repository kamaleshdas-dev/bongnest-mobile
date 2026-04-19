/** ₹99 connect fee — Razorpay expects amount in paise (smallest currency unit). */
export const CONNECT_UNLOCK_FEE_PAISE = 9900;

export const RAZORPAY_MERCHANT_NAME = "BongNest";

export const RAZORPAY_CHECKOUT_DESCRIPTION = "Unlock Owner Contact";

/** Set `EXPO_PUBLIC_RAZORPAY_KEY_ID` in `.env` (e.g. `rzp_test_...`). */
export function getRazorpayKeyId(): string {
  return (process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID ?? "").trim();
}
