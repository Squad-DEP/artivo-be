export interface SquadTransaction {
    transaction_reference: string;
    virtual_account_number: string;
    principal_amount: string;
    settled_amount: string;
    fee_charged: string;
    transaction_date: string;
    transaction_indicator: 'C' | 'D';
    remarks: string;
    currency: string;
    frozen_transaction?: {
        freeze_transaction_ref: string;
        reason: string;
    } | null;
    customer?: {
        customer_identifier: string;
    };
}

export interface TransactionQueryResponse {
    status: number;
    success: boolean;
    message: string;
    data: SquadTransaction[];
}
