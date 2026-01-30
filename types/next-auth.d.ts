import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  /**
   * Extended Session interface with custom user fields
   */
  interface Session {
    user: {
      id: string;
      email: string;
      role: 'user' | 'instructor';
    } & DefaultSession['user'];
  }

  /**
   * Extended User interface with custom fields
   */
  interface User {
    id: string;
    email: string;
    role: 'user' | 'instructor';
  }
}

declare module '@auth/core/jwt' {
  /**
   * Extended JWT interface with custom claims
   */
  interface JWT {
    id: string;
    role: 'user' | 'instructor';
  }
}
