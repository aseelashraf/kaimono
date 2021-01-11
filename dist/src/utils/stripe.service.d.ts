export declare class StripeService {
    constructor();
    createChargePayment(obj: any): Promise<any>;
    createPaymentIntents(obj: any): Promise<any>;
    capturePaymentIntents(id: any, obj: any): Promise<any>;
}
