import User from '../../models/User';

/**
 * EmailVerificationService - Handles email verification operations
 * Follows Single Responsibility Principle: Only manages email verification
 */
export class EmailVerificationService {
    /**
     * Generate a 6-digit verification code
     */
    private generateVerificationCode(): string {
        return String(Math.floor(Math.random() * (999999 - 111111 + 1)) + 111111);
    }

    /**
     * Resend verification email to a user
     */
    async resendVerificationEmail(userId: string): Promise<{ email: string; verificationKey: string }> {
        const user = await User.findByPk(userId, { rejectOnEmpty: true });
        const verificationKey = this.generateVerificationCode();
        
        await user.update({ emailVerificationKey: verificationKey });

        // TODO: Replace with actual email service
        if (typeof global.it !== 'function') {
            console.log(`\n\nEMAIL THIS CODE TO THE USER\nCODE: ${verificationKey}\n\n`);
        }

        return { 
            email: user.email, 
            verificationKey 
        };
    }

    /**
     * Verify a user's email with the provided code
     */
    async verifyEmail(userId: string, verificationCode: string): Promise<boolean> {
        const user = await User.findByPk(userId, { rejectOnEmpty: true });
        
        if (user.emailVerificationKey === verificationCode) {
            await user.update({ 
                emailVerified: true,
                emailVerificationKey: null 
            });
            return true;
        }
        
        return false;
    }

    /**
     * Check if a user's email is verified
     */
    async isEmailVerified(userId: string): Promise<boolean> {
        const user = await User.findByPk(userId, { rejectOnEmpty: true });
        return user.emailVerified === true;
    }
}
