import { SquadService } from './SquadService';
import { VirtualAccount, VirtualAccountModel } from '../../models/VirtualAccount';
import { UserModel } from '../../models/User';

export class VirtualAccountService {
    private squadService: SquadService;

    constructor() {
        this.squadService = new SquadService();
    }

    /**
     * Create virtual account for a user after email verification
     * This is called automatically when user verifies their email
     */
    async createVirtualAccountForUser(user: UserModel): Promise<VirtualAccountModel | null> {
        try {
            // Check if Squad is configured
            if (!SquadService.isConfigured()) {
                console.warn('Squad not configured, skipping virtual account creation');
                return null;
            }

            // Check if user already has a virtual account
            const existing = await VirtualAccount.findOne({ where: { userId: user.id } });
            if (existing) {
                console.log(`User ${user.id} already has a virtual account`);
                return existing;
            }

            // Parse full name
            const nameParts = user.fullName.trim().split(' ');
            const firstName = nameParts[0] || user.fullName;
            const lastName = nameParts.slice(1).join(' ') || firstName;

            // Create virtual account via Squad API
            const squadResponse = await this.squadService.createVirtualAccount({
                customer_identifier: user.id,
                first_name: firstName,
                last_name: lastName,
                mobile_num: user.phone || '0000000000',  // Default if no phone
                email: user.email,
            });

            if (!squadResponse.success || !squadResponse.data) {
                throw new Error('Squad API did not return account data');
            }

            // Save to database
            const virtualAccount = await VirtualAccount.create({
                userId: user.id,
                customerIdentifier: squadResponse.data.customer_identifier,
                virtualAccountNumber: squadResponse.data.virtual_account_number,
                virtualAccountName: squadResponse.data.virtual_account_name,
                bankName: squadResponse.data.bank_name,
                bankCode: squadResponse.data.bank_code || null,
            });

            console.log(`✅ Virtual account created for user ${user.id}: ${squadResponse.data.virtual_account_number}`);

            return virtualAccount;
        } catch (error: any) {
            console.error('Failed to create virtual account:', error.message);
            // Don't throw - virtual account creation failure shouldn't block user flow
            return null;
        }
    }

    /**
     * Get virtual account for a user
     */
    async getVirtualAccountByUserId(userId: string): Promise<VirtualAccountModel | null> {
        return await VirtualAccount.findOne({ where: { userId } });
    }

    /**
     * Get virtual account by account number
     */
    async getVirtualAccountByNumber(accountNumber: string): Promise<VirtualAccountModel | null> {
        return await VirtualAccount.findOne({ where: { virtualAccountNumber: accountNumber } });
    }
}
