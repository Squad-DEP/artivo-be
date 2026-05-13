export interface VirtualAccountData {
    first_name: string;
    last_name: string;
    bank_code: string;
    virtual_account_number: string;
    beneficiary_account: string;
    customer_identifier: string;
    created_at: string;
    updated_at: string;
}

export interface InitiatePaymentData {
    checkout_url: string;
    merchant_amount: number;
    transaction_ref: string;
    email: string;
    currency: string;
    amount: number;
}

export interface AccountLookupData {
    account_name: string;
    account_number: string;
    bank_code: string;
}

export interface TransferData {
    transaction_reference: string;
    response_code: string;
    response_message: string;
    amount: string;    // kobo
    currency: string;
    transaction_date: string;
    bank_code: string;
    account_number: string;
    account_name?: string;
}

export interface TransactionVerifyData {
    transaction_ref: string;
    merchant_ref: string;
    gateway_ref: string;
    transaction_status: string; // 'success' | 'failed' | 'pending'
    email: string;
    amount: number;             // in kobo
    currency_id: string;
    merchant_amount: number;
    transaction_type: string;
    transaction_date: string;
    payment_type?: string;
}

export interface SquadSuccessResponse<T = any> {
    status: number;
    success: true;
    message: string;
    data: T;
}

export interface SquadErrorResponse {
    status: number;
    success: false;
    message: string;
    data: Record<string, any>;
}

export type SquadResponse<T = any> = SquadSuccessResponse<T> | SquadErrorResponse;

export type VirtualAccountResponse = SquadResponse<VirtualAccountData>;
export type VirtualAccountDetailsResponse = SquadResponse<VirtualAccountData>;
export type InitiatePaymentResponse = SquadResponse<InitiatePaymentData>;
export type AccountLookupResponse = SquadResponse<AccountLookupData>;
export type TransferResponse = SquadResponse<TransferData>;
export type TransactionVerifyResponse = SquadResponse<TransactionVerifyData>;
