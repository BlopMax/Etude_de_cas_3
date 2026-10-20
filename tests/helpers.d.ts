import type { HydratedDocument } from 'mongoose';
import type { IColumn } from '../src/models/Column.js';
/**
 * Test helper utilities.
 *
 * Provides functions to create test data and authenticate requests.
 *
 * @example
 * ```typescript
 * import { createTestUser, getAuthToken, createTestColumn } from './helpers';
 *
 * const user = await createTestUser();
 * const token = getAuthToken(user);
 * ```
 */
/**
 * Creates a test user in the database.
 *
 * @param email - User email (default: 'test@example.com')
 * @param password - User password (default: 'password123')
 * @returns Created user document
 *
 * @example
 * ```typescript
 * const user = await createTestUser('user@test.com', 'mypassword');
 * ```
 */
export declare function createTestUser(email?: string, password?: string): Promise<import("mongoose").Document<unknown, {}, import("../src/models/User.js").IUser, {}, {}> & import("../src/models/User.js").IUser & Required<{
    _id: import("mongoose").Types.ObjectId;
}> & {
    __v: number;
}>;
/**
 * Generates a JWT token for a user.
 *
 * @param user - User document or user ID
 * @param secret - JWT secret (default: from env or test secret)
 * @returns JWT token string
 *
 * @example
 * ```typescript
 * const user = await createTestUser();
 * const token = getAuthToken(user);
 * ```
 */
export declare function getAuthToken(user: {
    _id: any;
    email: string;
}, secret?: string): string;
/**
 * Creates a test column in the database.
 *
 * @param name - Column name (default: 'Test Column')
 * @param position - Column position (default: 0)
 * @returns Created column document
 *
 * @example
 * ```typescript
 * const column = await createTestColumn('To Do', 0);
 * ```
 */
export declare function createTestColumn(name?: string, position?: number): Promise<HydratedDocument<IColumn>>;
/**
 * Creates a test OF in the database.
 *
 * @param columnId - Column ID
 * @param title - OF title (default: 'Test OF')
 * @param description - OF description (optional)
 * @param position - OF position (default: 0)
 * @returns Created OF document
 *
 * @example
 * ```typescript
 * const column = await createTestColumn();
 * const of = await createTestOF(column._id.toString(), 'My Task');
 * ```
 */
export declare function createTestOF(columnId: string, title?: string, description?: string, position?: number): Promise<import("mongoose").Document<unknown, {}, import("../src/models/OF.js").IOF, {}, {}> & import("../src/models/OF.js").IOF & Required<{
    _id: unknown;
}> & {
    __v: number;
}>;
//# sourceMappingURL=helpers.d.ts.map