export interface CreateVirtualAccountRequest {
    customer_identifier: string;
    first_name: string;
    last_name: string;
    mobile_num: string;
    email: string;
    bvn?: string;
    dob?: string;
    address?: string;
    gender?: '1' | '2';
    beneficiary_account?: string;
}

/** POST /transaction/initiate — get a checkout URL for a one-time payment */
export interface InitiatePaymentRequest {
    email: string;
    amount: number;             // in kobo (NGN * 100)
    currency: string;           // e.g. 'NGN'
    initiate_type: 'inline' | 'redirect';
    transaction_ref: string;    // unique merchant-generated reference
    callback_url: string;
    customer_name?: string;
    pass_charge?: boolean;
    payment_channels?: Array<'card' | 'bank_transfer' | 'ussd' | 'squad'>;
}

/**
 * POST /payout/account/lookup — verify recipient name before initiating a transfer.
 * Always call this before POST /payout/transfer.
 */
export interface AccountLookupRequest {
    bank_code: string;
    account_number: string;
}

/**
 * POST /payout/transfer — move funds from Squad ledger to a Nigerian bank account.
 * transaction_reference must follow the format: MERCHANTID_REFERENCE
 * amount must be a string in kobo.
 * account_name must be the verified name from account lookup.
 */
export interface InitiateTransferRequest {
    transaction_reference: string; // format: MERCHANTID_REFERENCE
    amount: string;                // in kobo, as a string e.g. "10000" = ₦100
    bank_code: string;
    account_number: string;
    account_name: string;          // required — must be verified via lookup first
    currency_id: 'NGN';
    remark: string;
}

/** POST /payout/requery — re-check transfer outcome (use after a 424 timeout) */
export interface TransferRequeryRequest {
    transaction_reference: string;
}

/** POST /payout/list — paginated history of all transfers */
export interface ListTransfersRequest {
    page?: number;
    per_page?: number;
    dir?: 'ASC' | 'DESC';
}
