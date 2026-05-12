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
