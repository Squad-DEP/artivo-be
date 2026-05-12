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
