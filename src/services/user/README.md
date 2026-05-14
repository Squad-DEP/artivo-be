# User Services

This module has been refactored to follow SOLID principles, specifically the **Single Responsibility Principle (SRP)**.

## Architecture

The original `UserService` was a "God Object" that handled multiple unrelated concerns. It has been split into focused, cohesive services:

### 1. **UserService** (`UserService.ts`)
**Responsibility**: Core user profile operations

**Methods**:
- `getUserById(userId)` - Retrieve user by ID
- `updateUser(userId, data)` - Update user profile
- `userExists(userId)` - Check if user exists

**Use when**: You need to read or update basic user profile information.

---

### 2. **PasswordService** (`PasswordService.ts`)
**Responsibility**: Password management and security

**Methods**:
- `hashPassword(plainPassword)` - Hash a plain text password
- `comparePassword(plainPassword, hashedPassword)` - Verify password
- `updatePassword(userId, newPassword)` - Update user's password
- `validatePasswordStrength(password)` - Validate password meets requirements

**Use when**: You need to handle password operations (hashing, validation, updates).

---

### 3. **EmailVerificationService** (`EmailVerificationService.ts`)
**Responsibility**: Email verification workflows

**Methods**:
- `resendVerificationEmail(userId)` - Generate and send verification code
- `verifyEmail(userId, verificationCode)` - Verify email with code
- `isEmailVerified(userId)` - Check verification status

**Use when**: You need to handle email verification flows.

---

### 4. **UserJobQueryService** (`UserJobQueryService.ts`)
**Responsibility**: Job-related queries from user perspective

**Methods**:
- `getJobById(jobId, userId)` - Get job details for a user
- `getJobApplications(jobId, userId)` - Get applications for a job

**Use when**: You need to query jobs from a user's perspective (as customer or worker).

---

## SOLID Principles Applied

### ✅ Single Responsibility Principle (SRP)
Each service has one reason to change:
- `UserService` changes only when user profile logic changes
- `PasswordService` changes only when password requirements change
- `EmailVerificationService` changes only when verification flow changes
- `UserJobQueryService` changes only when job query logic changes

### ✅ Open/Closed Principle (OCP)
Services are open for extension but closed for modification. You can extend functionality by:
- Adding new services without modifying existing ones
- Implementing interfaces for dependency injection

### ✅ Dependency Inversion Principle (DIP)
Services depend on abstractions (database models) rather than concrete implementations.

### ✅ Interface Segregation Principle (ISP)
Clients only depend on the methods they use. Routes import only the services they need.

---

## Usage Example

```typescript
import { 
    UserService, 
    PasswordService, 
    EmailVerificationService, 
    UserJobQueryService 
} from '../services/user';

// Initialize services
const userService = new UserService();
const passwordService = new PasswordService();
const emailVerificationService = new EmailVerificationService();
const userJobQueryService = new UserJobQueryService();

// Use specific services for specific tasks
const user = await userService.getUserById(userId);
await passwordService.updatePassword(userId, newPassword);
await emailVerificationService.resendVerificationEmail(userId);
const job = await userJobQueryService.getJobById(jobId, userId);
```

---

## Migration Guide

### Before (Old Code)
```typescript
import { UserService } from '../services/user/UserService';

const userService = new UserService();
await userService.updatePassword(userId, newPassword);
await userService.resendVerificationEmail(userId);
await userService.getJobById(jobId, userId);
```

### After (New Code)
```typescript
import { 
    UserService, 
    PasswordService, 
    EmailVerificationService, 
    UserJobQueryService 
} from '../services/user';

const userService = new UserService();
const passwordService = new PasswordService();
const emailVerificationService = new EmailVerificationService();
const userJobQueryService = new UserJobQueryService();

await passwordService.updatePassword(userId, newPassword);
await emailVerificationService.resendVerificationEmail(userId);
await userJobQueryService.getJobById(jobId, userId);
```

---

## Benefits

1. **Maintainability**: Each service is small and focused, making it easier to understand and modify
2. **Testability**: Services can be tested in isolation with minimal mocking
3. **Reusability**: Services can be composed and reused across different parts of the application
4. **Scalability**: New functionality can be added without modifying existing services
5. **Team Collaboration**: Different developers can work on different services without conflicts

---

## Future Improvements

1. **Dependency Injection**: Implement a DI container for better testability
2. **Interfaces**: Define TypeScript interfaces for each service
3. **Email Service**: Replace console.log with actual email service integration
4. **Caching**: Add caching layer for frequently accessed user data
5. **Events**: Implement event-driven architecture for cross-service communication
