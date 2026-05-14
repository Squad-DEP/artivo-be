import User from '../../models/User';
import bcrypt from 'bcryptjs';

/**
 * PasswordService - Handles password-related operations
 * Follows Single Responsibility Principle: Only manages password operations
 */
export class PasswordService {
    private readonly SALT_ROUNDS = 10;

    /**
     * Hash a plain text password
     */
    hashPassword(plainPassword: string): string {
        const salt = bcrypt.genSaltSync(this.SALT_ROUNDS);
        return bcrypt.hashSync(plainPassword, salt);
    }

    /**
     * Compare a plain text password with a hashed password
     */
    comparePassword(plainPassword: string, hashedPassword: string): boolean {
        return bcrypt.compareSync(plainPassword, hashedPassword);
    }

    /**
     * Update a user's password
     */
    async updatePassword(userId: string, newPassword: string): Promise<void> {
        const hashedPassword = this.hashPassword(newPassword);
        
        await User.unscoped().update(
            { password: hashedPassword },
            { where: { id: userId } }
        );
    }

    /**
     * Validate password strength
     */
    validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        if (password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Password must contain at least one uppercase letter');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Password must contain at least one lowercase letter');
        }

        if (!/[0-9]/.test(password)) {
            errors.push('Password must contain at least one number');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }
}
