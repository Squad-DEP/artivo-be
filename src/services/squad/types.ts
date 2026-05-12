export interface CreateVirtualAccountRequest {
    customer_identifier: string;  // Unique user ID
    first_name: string;
    last_name: string;
    mobile_num: string;
    email: string;
    bvn?: string;
    dob?: string;  // Format: DD/MM/YYYY
    address?: string;
    gender?: '1' | '2';  // 1 = Male, 2 = Female
}

export interface VirtualAccountResponse {
    status: number;
    success: boolean;
    message: string;
    data?: {
        customer_identifier: string;
        virtual_account_number: string;
        virtual_account_name: string;
        bank_name: string;
        bank_code?: string;
    };
}

export interface SquadErrorResponse {
    status: number;
    success: boolean;
    message: string;
    data?: any;
}

export interface GetVirtualAccountRequest {
    customer_identifier: string;
}

export interface VirtualAccountDetails extends VirtualAccountResponse {
    data?: VirtualAccountResponse['data'] & {
        created_at?: string;
        updated_at?: string;
    };
}
