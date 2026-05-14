import User from '../../models/User';

/**
 * UserService - Handles core user profile operations
 * Follows Single Responsibility Principle: Only manages user data
 */
export class UserService {
    /**
     * Retrieve a user by their ID
     */
    async getUserById(userId: string) {
        return await User.findByPk(userId, { rejectOnEmpty: true });
    }

    /**
     * Update user profile information
     */
    async updateUser(userId: string, data: { fullName?: string; phone?: string }) {
        const user = await User.findByPk(userId, { rejectOnEmpty: true });
        await user.update(data);
        return user;
    }

    /**
     * Check if a user exists
     */
    async userExists(userId: string): Promise<boolean> {
        const user = await User.findByPk(userId);
        return user !== null;
    }
}
