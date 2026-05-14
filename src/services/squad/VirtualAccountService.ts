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
    async createVirtualAccountForUser(
        user: UserModel,
        kyc?: { bvn: string; dob: string; gender: '1' | '2'; address: string; first_name?: string; last_name?: string; phone?: string }
    ): Promise<VirtualAccountModel | null> {
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

            // Use KYC-provided name if given, otherwise fall back to user profile
            const { firstName: defaultFirst, lastName: defaultLast } = this.parseFullName(user.fullName);
            const firstName = kyc?.first_name || defaultFirst;
            const lastName = kyc?.last_name || defaultLast;

            // dob from KYC is YYYY-MM-DD; Squad expects MM/DD/YYYY
            const rawDob = kyc?.dob || user.dob || '1990-01-01';
            const [y, m, d] = rawDob.split('-');
            const dob = `${m}/${d}/${y}`;

            const squadResponse = await this.squadService.createVirtualAccount({
                customer_identifier: user.id,
                first_name: firstName,
                last_name: lastName,
                mobile_num: this.normalizePhone(kyc?.phone || user.phone),
                email: user.email,
                dob,
                bvn: kyc?.bvn || '00000000000',
                gender: kyc?.gender || '1',
                address: kyc?.address || '1 Artivo Street',
                beneficiary_account: process.env.SQUAD_BENEFICIARY_ACCOUNT,
            });

            // Validate Squad response
            if (!squadResponse.success || !squadResponse.data) {
                throw new Error('Squad API returned invalid response structure');
            }

            // Save to database
            const virtualAccount = await this.saveVirtualAccount(user.id, squadResponse.data);

            this.logSuccess(
                `Virtual account created for user ${user.id}: ${squadResponse.data.virtual_account_number}`,
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
    async ensureSetupForUser(
        userId: string,
        kyc: { bvn: string; dob: string; gender: '1' | '2'; address: string; first_name?: string; last_name?: string; phone?: string }
    ): Promise<VirtualAccountModel | null> {
        const user = await User.unscoped().findOne({ where: { id: userId } });
        if (!user) throw new Error('User not found');

        if (!user.emailVerified) {
            await user.update({ emailVerified: true, emailVerificationKey: null });
        }

        const existing = await this.getVirtualAccountByUserId(userId);
        if (existing) return existing;

        return this.createVirtualAccountForUser(user, kyc);
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
    private normalizePhone(phone?: string | null): string {
        if (!phone) return '00000000000';
        // Strip all non-digits
        const digits = phone.replace(/\D/g, '');
        // Convert +234XXXXXXXXXX → 0XXXXXXXXXX (11 digits)
        if (digits.startsWith('234') && digits.length === 13) {
            return '0' + digits.slice(3);
        }
        // Already 11 or 13 digits — use as-is
        if (digits.length === 11 || digits.length === 13) return digits;
        // Fallback placeholder
        return '00000000000';
    }

    /**
     * Save virtual account to database
     */
    private async saveVirtualAccount(
        userId: string,
        squadData: any,
    ): Promise<VirtualAccountModel> {
        return VirtualAccount.create({
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
                error,
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
