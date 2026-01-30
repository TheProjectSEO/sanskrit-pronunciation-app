import NextAuth, { User } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { z } from 'zod';
import { verifyPassword } from './lib/auth/password';
import { getServiceSupabase } from './lib/supabase/service';

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: '/signin',
    error: '/signin',
  },

  providers: [
    // Email/Password Authentication
    Credentials({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<User | null> {
        // Validate credentials format
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(1),
          })
          .safeParse(credentials);

        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const supabase = getServiceSupabase();

        // Fetch user from database
        const { data: user } = await supabase
          .from('users')
          .select('id, email, password_hash, role, first_name, last_name, is_active')
          .eq('email', email.toLowerCase())
          .single();

        // Validate user exists, is active, and has a password
        if (!user || !user.is_active || !user.password_hash) return null;

        // Verify password
        const isValid = await verifyPassword(user.password_hash, password);
        if (!isValid) return null;

        // Return user object
        return {
          id: user.id,
          email: user.email,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          role: user.role as 'user' | 'instructor',
        };
      },
    }),

    // Google OAuth
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],

  callbacks: {
    /**
     * Handle OAuth sign-in: create/link accounts
     */
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const supabase = getServiceSupabase();

        // Check if user already exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, role, is_active')
          .eq('email', user.email?.toLowerCase())
          .single();

        if (!existingUser) {
          // Create new user for Google OAuth
          const { data: newUser } = await supabase
            .from('users')
            .insert({
              email: user.email?.toLowerCase(),
              first_name: user.name?.split(' ')[0],
              last_name: user.name?.split(' ').slice(1).join(' '),
              role: 'user',
              is_active: true,
            })
            .select()
            .single();

          if (!newUser) return false;

          user.id = newUser.id;
          user.role = 'user';
        } else {
          // Check if account is active
          if (!existingUser.is_active) return false;

          user.id = existingUser.id;
          user.role = existingUser.role;
        }

        // Link OAuth account (upsert to handle reconnections)
        await supabase.from('oauth_accounts').upsert({
          user_id: user.id,
          provider: 'google',
          provider_account_id: account.providerAccountId,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at
            ? new Date(account.expires_at * 1000).toISOString()
            : null,
        });
      }

      return true;
    },

    /**
     * Add custom claims to JWT token
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    /**
     * Add custom claims to session object
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as 'user' | 'instructor';
      }
      return session;
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },

  trustHost: true,
});
