export interface SquadWebhookPayload {
    transaction_ref: string;
    virtual_account_number: string;
    principal_amount: string;
    settled_amount: string;
    fee_charged: string;
    transaction_date: string;
    customer_identifier: string;
    transaction_indicator: string;
    remarks: string;
    currency: string;
    channel?: string;
    sender_name?: string;
}

export interface WebhookErrorLog {
    id: string;
    payload: SquadWebhookPayload & {
        hash: string;
        meta?: any;
        encrypted_body?: string;
    };
    transaction_ref: string;
}

export interface WebhookErrorLogResponse {
    status: number;
    success: boolean;
    message: string;
    data: {
        count: number;
        rows: WebhookErrorLog[];
    };
}
