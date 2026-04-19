declare module "react-native-razorpay" {
  export interface RazorpayPaymentSuccess {
    razorpay_payment_id?: string;
    razorpay_order_id?: string;
    razorpay_signature?: string;
  }

  export default class RazorpayCheckout {
    static open(options: Record<string, unknown>): Promise<RazorpayPaymentSuccess>;
  }
}
