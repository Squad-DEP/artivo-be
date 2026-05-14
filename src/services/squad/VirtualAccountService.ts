import { SquadService } from './SquadService';
import { VirtualAccount, VirtualAccountModel } from '../../models/VirtualAccount';
import { User, UserModel } from '../../models/User';
import { SquadError, SquadDuplicateCustomerError } from './SquadErrors';

export class VirtualAccountService {
    private squadService: SquadService;

    constructor(squadService?: SquadService) {
        this.squadService = squadService || new SquadService();
    }

    /**
     * Create virtual account for a user after email verification
     * Idempotent: Safe to call multiple times for same user
     */
    async createVirtualAccountForUser(user: UserModel): Promise<VirtualAccountModel | null> {
        try {
            // Check if Squad is configured
            if (!SquadService.isConfigured()) {
                this.logWarning('Squad not configured, skipping virtual account creation');
                return null;
            }

            // Check if user already has a virtual account (idempotency)
            const existing = await this.getVirtualAccountByUserId(user.id);
            if (existing) {
                this.logInfo(`User ${user.id} already has virtual account: ${existing.virtualAccountNumber}`);
                return existing;
            }

            this.validateUserData(user);

            // Parse full name
            const { firstName, lastName } = this.parseFullName(user.fullName);

            // Create virtual account via Squad API
            const squadResponse = await this.squadService.createVirtualAccount({
                customer_identifier: user.id,
                first_name: firstName,
                last_name: lastName,
                mobile_num: user.phone || this.getDefaultPhoneNumber(),
                email: user.email,
                // Squad expects DD/MM/YYYY. Use stored dob if available, else demo placeholder.
                dob: user.dob
                    ? user.dob.split('-').reverse().join('/')   // YYYY-MM-DD → DD/MM/YYYY
                    : '01/01/1990',
            });

            // Validate Squad response
            if (!squadResponse.success || !squadResponse.data) {
                throw new Error('Squad API returned invalid response structure');
            }

            // Save to database
            const virtualAccount = await this.saveVirtualAccount(user.id, squadResponse.data);

            this.logSuccess(
                `Virtual account created for user ${user.id}: ${squadResponse.data.virtual_account_number}`
            );

            return virtualAccount;
        } catch (error) {
            return this.handleVirtualAccountCreationError(error, user.id);
        }
    }

    /**
     * Ensure a user's email is verified and virtual account exists.
     * Creates the virtual account if it doesn't exist yet.
     */
    async ensureSetupForUser(userId: string): Promise<VirtualAccountModel | null> {
        const user = await User.unscoped().findOne({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found');
        }

        if (!user.emailVerified) {
            await user.update({ emailVerified: true, emailVerificationKey: null });
        }

        const account = await this.getVirtualAccountByUserId(userId);
        if (account) {
            return account;
        }

        return this.createVirtualAccountForUser(user);
    }

    /**
     * Get virtual account for a user
     */
    async getVirtualAccountByUserId(userId: string): Promise<VirtualAccountModel | null> {
        try {
            return await VirtualAccount.findOne({ where: { userId } });
        } catch (error) {
            this.logError('Failed to query virtual account from database', error);
            return null;
        }
    }

    /**
     * Get virtual account by account number
     */
    async getVirtualAccountByNumber(accountNumber: string): Promise<VirtualAccountModel | null> {
        try {
            return await VirtualAccount.findOne({ where: { virtualAccountNumber: accountNumber } });
        } catch (error) {
            this.logError('Failed to query virtual account by number', error);
            return null;
        }
    }

    /**
     * Get virtual account by customer identifier (from Squad)
     */
    async getVirtualAccountByCustomerIdentifier(customerIdentifier: string): Promise<VirtualAccountModel | null> {
        try {
            return await VirtualAccount.findOne({ where: { customerIdentifier } });
        } catch (error) {
            this.logError('Failed to query virtual account by customer identifier', error);
            return null;
        }
    }

    /**
     * Sync virtual account from Squad API
     * Use this to recover if database record is lost
     */
    async syncVirtualAccountFromSquad(userId: string): Promise<VirtualAccountModel | null> {
        try {
            if (!SquadService.isConfigured()) {
                this.logWarning('Squad not configured, cannot sync virtual account');
                return null;
            }

            // Fetch from Squad API
            const squadResponse = await this.squadService.getVirtualAccount(userId);

            if (!squadResponse.success || !squadResponse.data) {
                this.logWarning(`No virtual account found in Squad for user ${userId}`);
                return null;
            }

            // Check if already exists in database
            const existing = await this.getVirtualAccountByUserId(userId);
            if (existing) {
                this.logInfo(`Virtual account already exists in database for user ${userId}`);
                return existing;
            }

            // Save to database
            const virtualAccount = await this.saveVirtualAccount(userId, squadResponse.data);

            this.logSuccess(`Synced virtual account from Squad for user ${userId}`);

            return virtualAccount;
        } catch (error) {
            this.logError(`Failed to sync virtual account from Squad for user ${userId}`, error);
            return null;
        }
    }

    // ========================================================================
    // PRIVATE HELPER METHODS
    // ========================================================================

    /**
     * Validate user data before creating virtual account
     */
    private validateUserData(user: UserModel): void {
        if (!user.id) {
            throw new Error('User ID is required');
        }

        if (!user.email) {
            throw new Error('User email is required');
        }

        if (!user.fullName || user.fullName.trim().length === 0) {
            throw new Error('User full name is required');
        }
    }

    /**
     * Parse full name into first and last name
     */
    private parseFullName(fullName: string): { firstName: string; lastName: string } {
        const nameParts = fullName.trim().split(/\s+/);
        const firstName = nameParts[0] || fullName;
        const lastName = nameParts.slice(1).join(' ') || firstName;

        return { firstName, lastName };
    }

    /**
     * Get default phone number when user doesn't have one
     */
    private getDefaultPhoneNumber(): string {
        // Use a placeholder that won't trigger BVN validation
        return '0000000000';
    }

    /**
     * Save virtual account to database
     */
    private async saveVirtualAccount(
        userId: string,
        squadData: any
    ): Promise<VirtualAccountModel> {
        return await VirtualAccount.create({
            userId,
            customerIdentifier: squadData.customer_identifier,
            virtualAccountNumber: squadData.virtual_account_number,
            virtualAccountName: `${squadData.first_name} ${squadData.last_name}`,
            bankName: 'GTCO', // Squad uses GTCO (Guaranty Trust Company)
            bankCode: squadData.bank_code,
        });
    }

    /**
     * Handle errors during virtual account creation
     */
    private handleVirtualAccountCreationError(error: any, userId: string): null {
        // Log the error with context
        if (error instanceof SquadDuplicateCustomerError) {
            this.logWarning(`Virtual account already exists in Squad for user ${userId}`);
            // Try to sync from Squad
            this.syncVirtualAccountFromSquad(userId).catch((syncError) => {
                this.logError('Failed to sync existing virtual account', syncError);
            });
        } else if (error instanceof SquadError) {
            this.logError(
                `Squad API error creating virtual account for user ${userId}: ${error.message}`,
                error
            );
        } else {
            this.logError(`Unexpected error creating virtual account for user ${userId}`, error);
        }

        // Don't throw - virtual account creation failure shouldn't block user flow
        // The user can still use the platform, just without payment capabilities
        return null;
    }

    // ========================================================================
    // LOGGING METHODS
    // ========================================================================

    private logInfo(message: string): void {
        console.log(`[VirtualAccountService] ${message}`, {
            timestamp: new Date().toISOString(),
        });
    }

    private logSuccess(message: string): void {
        console.log(`[VirtualAccountService] ✅ ${message}`, {
            timestamp: new Date().toISOString(),
        });
    }

    private logWarning(message: string): void {
        console.warn(`[VirtualAccountService] ⚠️  ${message}`, {
            timestamp: new Date().toISOString(),
        });
    }

    private logError(message: string, error: any): void {
        console.error(`[VirtualAccountService] ❌ ${message}`, {
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            code: error instanceof SquadError ? error.code : undefined,
            statusCode: error instanceof SquadError ? error.statusCode : undefined,
        });
    }
}
