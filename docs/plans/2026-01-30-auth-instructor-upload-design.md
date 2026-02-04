# Authentication & Instructor Upload System Design

**Date:** 2026-01-30
**Status:** Approved - Ready for Implementation
**Estimated Effort:** 15-20 hours

## Overview

This design adds two major features to the Tapaswe Sanskrit Pronunciation app:

1. **Authentication System** - NextAuth v5 + Supabase with email/password + Google OAuth
2. **Instructor Mantra Upload** - Hybrid recording/upload interface with automatic audio processing

## Feature 1: Authentication System

### Goals

- Open user registration (email/password + Google OAuth)
- Role-based access (users vs. instructor)
- Password reset via EmailJS
- Session management with JWT
- Supabase RLS policies for data security

### Architecture

**Identity Provider:** NextAuth v5 (handles authentication)
**Database:** Supabase Postgres (stores user data)
**JWT Pattern:** NextAuth session → mint Supabase JWT → RLS enforcement

```
User Login (Email/Password or Google)
         ↓
NextAuth validates credentials
         ↓
Creates NextAuth session JWT
(contains: id, email, role)
         ↓
On each API request:
         ↓
Server extracts NextAuth session
         ↓
Mints short-lived Supabase DB JWT (10 min)
(signed with SUPABASE_JWT_SECRET)
         ↓
Supabase client uses this JWT
         ↓
RLS policies evaluate auth.jwt() claims
```

### Database Schema

#### New Tables

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),  -- NULL for OAuth-only users
  role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'instructor')),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- OAuth accounts (Google, future providers)
CREATE TABLE oauth_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,  -- 'google', 'credentials'
  provider_account_id VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, provider_account_id)
);

CREATE INDEX idx_oauth_user ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_provider ON oauth_accounts(provider, provider_account_id);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX idx_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_reset_tokens_expires ON password_reset_tokens(expires_at);
```

#### Mantras Table Updates

```sql
-- Add columns to existing mantras table
ALTER TABLE mantras ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft'
  CHECK (status IN ('draft', 'published'));
ALTER TABLE mantras ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);
ALTER TABLE mantras ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE INDEX idx_mantras_status ON mantras(status);
CREATE INDEX idx_mantras_created_by ON mantras(created_by);
```

### Row Level Security (RLS)

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE mantras ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_audio_clips ENABLE ROW LEVEL SECURITY;

-- Users see their own profile only
CREATE POLICY "Users can view own profile"
ON users FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can only see published mantras
CREATE POLICY "Users see published mantras only"
ON mantras FOR SELECT
TO authenticated
USING (status = 'published');

-- Instructors can see and manage all mantras
CREATE POLICY "Instructors see all mantras"
ON mantras FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role = 'instructor'
  )
);

-- Reference audio clips inherit mantra visibility
CREATE POLICY "Clips follow mantra visibility"
ON reference_audio_clips FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM mantras
    WHERE mantras.id = reference_audio_clips.mantra_id
    AND (
      mantras.status = 'published'
      OR EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.role = 'instructor'
      )
    )
  )
);
```

### Authentication Implementation

#### File Structure

```
src/
├── auth.ts                          # NextAuth configuration
├── middleware.ts                    # Route protection
├── lib/
│   ├── auth/
│   │   └── password.ts             # bcrypt utilities
│   ├── email/
│   │   └── emailjs.ts              # Email sending
│   └── supabase/
│       ├── jwt.ts                  # JWT minting
│       ├── server.ts               # Authenticated client
│       └── service.ts              # Service role client
└── app/
    ├── api/
    │   └── auth/
    │       ├── [...nextauth]/route.ts
    │       ├── signup/route.ts
    │       ├── forgot-password/route.ts
    │       └── reset-password/route.ts
    ├── signin/page.tsx
    ├── signup/page.tsx
    └── reset-password/page.tsx
```

#### NextAuth Configuration (`src/auth.ts`)

```typescript
import NextAuth, { DefaultSession, User } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { z } from 'zod';
import { verifyPassword } from '@/lib/auth/password';
import { getServiceSupabase } from '@/lib/supabase/service';

// Extend session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      role: 'user' | 'instructor';
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    email: string;
    role: 'user' | 'instructor';
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: 'user' | 'instructor';
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    signIn: '/signin',
    error: '/signin',
  },

  providers: [
    // Email/Password
    Credentials({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials): Promise<User | null> {
        const parsed = z.object({
          email: z.string().email(),
          password: z.string().min(1),
        }).safeParse(credentials);

        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const supabase = getServiceSupabase();

        const { data: user } = await supabase
          .from('users')
          .select('id, email, password_hash, role, first_name, last_name, is_active')
          .eq('email', email.toLowerCase())
          .single();

        if (!user || !user.is_active || !user.password_hash) return null;

        const isValid = await verifyPassword(user.password_hash, password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: `${user.first_name} ${user.last_name}`,
          role: user.role as 'user' | 'instructor',
        };
      },
    }),

    // Google OAuth
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const supabase = getServiceSupabase();
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
            })
            .select()
            .single();

          user.id = newUser.id;
          user.role = 'user';
        } else {
          user.id = existingUser.id;
          user.role = existingUser.role;
        }

        // Link OAuth account
        await supabase.from('oauth_accounts').upsert({
          user_id: user.id,
          provider: 'google',
          provider_account_id: account.providerAccountId,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
        });
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
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
```

#### Middleware (`src/middleware.ts`)

```typescript
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const publicRoutes = ['/signin', '/signup', '/reset-password', '/api/auth'];
const instructorRoutes = ['/instructor'];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  // Allow public routes
  const isPublicRoute = publicRoutes.some(route =>
    nextUrl.pathname.startsWith(route)
  );
  if (isPublicRoute) return NextResponse.next();

  // Redirect to signin if not logged in
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/signin', nextUrl));
  }

  // Check instructor access
  const isInstructorRoute = instructorRoutes.some(route =>
    nextUrl.pathname.startsWith(route)
  );
  if (isInstructorRoute && req.auth?.user?.role !== 'instructor') {
    return NextResponse.redirect(new URL('/', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

#### Password Utilities (`lib/auth/password.ts`)

```typescript
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  storedHash: string,
  inputPassword: string
): Promise<boolean> {
  return bcrypt.compare(inputPassword, storedHash);
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain an uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain a lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain a number');
  }

  return { valid: errors.length === 0, errors };
}
```

### EmailJS Integration

#### Email Service (`lib/email/emailjs.ts`)

```typescript
import emailjs from '@emailjs/browser';

const SERVICE_ID = process.env.EMAILJS_SERVICE_ID!;
const PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY!;

export async function sendWelcomeEmail(email: string, name: string) {
  return emailjs.send(
    SERVICE_ID,
    process.env.EMAILJS_WELCOME_TEMPLATE_ID!,
    {
      to_email: email,
      user_name: name,
    },
    PUBLIC_KEY
  );
}

export async function sendPasswordResetEmail(email: string, resetToken: string) {
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;

  return emailjs.send(
    SERVICE_ID,
    process.env.EMAILJS_RESET_TEMPLATE_ID!,
    {
      to_email: email,
      reset_url: resetUrl,
    },
    PUBLIC_KEY
  );
}
```

#### Password Reset API (`app/api/auth/forgot-password/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getServiceSupabase } from '@/lib/supabase/service';
import { sendPasswordResetEmail } from '@/lib/email/emailjs';

export async function POST(req: NextRequest) {
  const { email } = await req.json();

  const supabase = getServiceSupabase();

  // Check if user exists
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email.toLowerCase())
    .single();

  if (!user) {
    // Don't reveal if email exists
    return NextResponse.json({ success: true });
  }

  // Generate reset token (JWT, 1 hour expiry)
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
  const resetToken = await new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(secret);

  // Store token in DB
  await supabase.from('password_reset_tokens').insert({
    email: user.email,
    token: resetToken,
    expires_at: new Date(Date.now() + 3600000), // 1 hour
  });

  // Send email
  await sendPasswordResetEmail(user.email, resetToken);

  return NextResponse.json({ success: true });
}
```

## Feature 2: Instructor Mantra Upload

### Goals

- Hybrid upload method (record in-browser OR upload file)
- Automatic audio processing (Whisper transcription + word segmentation)
- Draft/published status workflow
- Instructor review interface for auto-generated clips
- Ability to re-record individual word clips

### Upload Flow

```
Instructor → /instructor/upload
         ↓
Record OR Upload audio file
         ↓
POST /api/instructor/upload-mantra
         ↓
Validate audio (format, size, duration)
         ↓
Upload to Supabase Storage
         ↓
Create mantra record (status: 'draft')
         ↓
Create processing job (status: 'pending')
         ↓
Trigger background processing
         ↓
Whisper transcription (word timestamps)
         ↓
Segment audio into word clips
         ↓
Store clips in reference_audio_clips
         ↓
Mark job as 'completed'
         ↓
Instructor reviews on /instructor/mantras/[id]
         ↓
Publish → status: 'published'
         ↓
Visible to all users
```

### Upload Interface (`app/instructor/upload/page.tsx`)

```typescript
'use client';

import { useState } from 'react';
import { RecordButton } from '@/components/practice/RecordButton';

export default function UploadMantraPage() {
  const [uploadMode, setUploadMode] = useState<'record' | 'file'>('record');
  const [mantraText, setMantraText] = useState('');
  const [devanagariText, setDevanagariText] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload() {
    if (!audioBlob || !mantraText) return;

    setUploading(true);

    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('text', mantraText);
    formData.append('devanagari', devanagariText);

    const res = await fetch('/api/instructor/upload-mantra', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (data.success) {
      window.location.href = `/instructor/mantras/${data.mantraId}`;
    } else {
      alert(data.error);
    }

    setUploading(false);
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Upload New Mantra</h1>

      {/* Mode Toggle */}
      <div className="flex gap-4 mb-6">
        <button
          className={`px-4 py-2 rounded ${uploadMode === 'record' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setUploadMode('record')}
        >
          🎙️ Record Audio
        </button>
        <button
          className={`px-4 py-2 rounded ${uploadMode === 'file' ? 'bg-orange-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setUploadMode('file')}
        >
          📁 Upload File
        </button>
      </div>

      {/* Mantra Text Input */}
      <div className="mb-4">
        <label className="block font-medium mb-2">Mantra Text (Required)</label>
        <input
          type="text"
          placeholder="e.g., Om Namo Bhagavate Vasudevaya"
          className="w-full p-3 border rounded"
          value={mantraText}
          onChange={(e) => setMantraText(e.target.value)}
        />
      </div>

      <div className="mb-6">
        <label className="block font-medium mb-2">Devanagari (Optional)</label>
        <input
          type="text"
          placeholder="e.g., ॐ नमो भगवते वासुदेवाय"
          className="w-full p-3 border rounded"
          value={devanagariText}
          onChange={(e) => setDevanagariText(e.target.value)}
        />
      </div>

      {/* Audio Input */}
      {uploadMode === 'record' ? (
        <div className="mb-6">
          <label className="block font-medium mb-2">Record Reference Audio</label>
          <RecordButton onRecordingComplete={setAudioBlob} />
        </div>
      ) : (
        <div className="mb-6">
          <label className="block font-medium mb-2">Upload Audio File</label>
          <input
            type="file"
            accept="audio/mp3,audio/wav,audio/m4a"
            className="w-full p-3 border rounded"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setAudioBlob(file);
            }}
          />
          <p className="text-sm text-gray-500 mt-2">
            Supported formats: MP3, WAV, M4A (max 10MB)
          </p>
        </div>
      )}

      {/* Preview */}
      {audioBlob && (
        <div className="mb-6 p-4 bg-gray-50 rounded">
          <p className="font-medium mb-2">Preview:</p>
          <audio src={URL.createObjectURL(audioBlob)} controls className="w-full" />
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleUpload}
        disabled={!audioBlob || !mantraText || uploading}
        className="w-full bg-orange-500 text-white py-3 rounded font-medium disabled:bg-gray-300"
      >
        {uploading ? '⏳ Uploading & Processing...' : '✅ Upload & Process'}
      </button>
    </div>
  );
}
```

### Upload API Endpoint (`app/api/instructor/upload-mantra/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getAuthenticatedSupabase, getServiceSupabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const session = await auth();

  // Check instructor role
  if (session?.user?.role !== 'instructor') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const formData = await req.formData();
  const audioFile = formData.get('audio') as File;
  const mantraText = formData.get('text') as string;
  const devanagariText = formData.get('devanagari') as string;

  // Validate audio file
  if (!audioFile || audioFile.size === 0) {
    return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
  }

  if (audioFile.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
  }

  const allowedTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/m4a'];
  if (!allowedTypes.includes(audioFile.type)) {
    return NextResponse.json({ error: 'Invalid audio format' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Check for duplicates
  const { data: existing } = await supabase
    .from('mantras')
    .select('id, title')
    .ilike('text', mantraText.trim())
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({
      error: 'Duplicate mantra',
      message: `A mantra with similar text already exists: "${existing[0].title}"`,
    }, { status: 409 });
  }

  // 1. Upload audio to Supabase Storage
  const fileName = `mantras/${Date.now()}-${audioFile.name}`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('reference-audio')
    .upload(fileName, audioFile);

  if (uploadError) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }

  // 2. Create mantra record (draft status)
  const { data: mantra, error: insertError } = await supabase
    .from('mantras')
    .insert({
      title: mantraText.substring(0, 50),
      text: mantraText,
      text_devanagari: devanagariText || null,
      reference_audio_url: uploadData.path,
      status: 'draft',
      created_by: session.user.id,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: 'Failed to create mantra' }, { status: 500 });
  }

  // 3. Create processing job
  const { data: job } = await supabase
    .from('mantra_processing_jobs')
    .insert({
      mantra_id: mantra.id,
      status: 'pending',
    })
    .select()
    .single();

  // 4. Trigger background processing (fire and forget)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/instructor/process-mantra`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId: job.id }),
  }).catch(console.error);

  return NextResponse.json({
    success: true,
    mantraId: mantra.id,
    jobId: job.id,
  });
}
```

### Processing Pipeline (`app/api/instructor/process-mantra/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { transcribeWithWhisper } from '@/lib/whisper-transcribe';
import { segmentAudioIntoClips } from '@/lib/segment-audio';

export async function POST(req: NextRequest) {
  const { jobId } = await req.json();
  const supabase = getServiceSupabase();

  try {
    // Update job status
    await supabase
      .from('mantra_processing_jobs')
      .update({ status: 'transcribing', started_at: new Date().toISOString() })
      .eq('id', jobId);

    // Get job and mantra details
    const { data: job } = await supabase
      .from('mantra_processing_jobs')
      .select(`
        *,
        mantras (
          id,
          text,
          reference_audio_url
        )
      `)
      .eq('id', jobId)
      .single();

    if (!job) throw new Error('Job not found');

    // Step 1: Download audio from Supabase Storage
    const { data: audioBlob } = await supabase.storage
      .from('reference-audio')
      .download(job.mantras.reference_audio_url);

    if (!audioBlob) throw new Error('Failed to download audio');

    // Step 2: Transcribe with Whisper
    const transcription = await transcribeWithWhisper(audioBlob);

    // Update job with transcription
    await supabase
      .from('mantra_processing_jobs')
      .update({
        status: 'segmenting',
        reference_transcription: transcription,
        total_words: transcription.words.length,
      })
      .eq('id', jobId);

    // Step 3: Segment audio into word clips
    const clips = await segmentAudioIntoClips(
      audioBlob,
      transcription,
      job.mantras.text
    );

    // Step 4: Store clips in database
    const clipInserts = clips.map(clip => ({
      mantra_id: job.mantras.id,
      clip_type: clip.type,
      text: clip.text,
      word_index_start: clip.wordIndexStart,
      word_index_end: clip.wordIndexEnd,
      start_time: clip.startTime,
      end_time: clip.endTime,
      duration_ms: clip.durationMs,
      audio_url: clip.audioUrl,
    }));

    await supabase.from('reference_audio_clips').insert(clipInserts);

    // Step 5: Mark job complete
    await supabase
      .from('mantra_processing_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        clips_generated: clips.length,
        clips_expected: clips.length,
      })
      .eq('id', jobId);

    return NextResponse.json({ success: true, clipsGenerated: clips.length });

  } catch (error: any) {
    console.error('Processing error:', error);

    // Update job with error
    await supabase
      .from('mantra_processing_jobs')
      .update({
        status: 'failed',
        error_message: error.message,
        error_details: { stack: error.stack },
      })
      .eq('id', jobId);

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Whisper Integration (`lib/whisper-transcribe.ts`)

```typescript
import OpenAI from 'openai';

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

interface WhisperTranscription {
  text: string;
  words: WhisperWord[];
}

export async function transcribeWithWhisper(
  audioBlob: Blob,
  maxRetries = 3
): Promise<WhisperTranscription> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Convert blob to file
      const audioFile = new File([audioBlob], 'audio.mp3', {
        type: 'audio/mp3',
      });

      // Transcribe with word-level timestamps
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
        language: 'sa', // Sanskrit
      });

      return {
        text: transcription.text,
        words: transcription.words?.map(w => ({
          word: w.word,
          start: w.start,
          end: w.end,
        })) || [],
      };

    } catch (error: any) {
      console.error(`Transcription attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        throw new Error(`Transcription failed after ${maxRetries} attempts: ${error.message}`);
      }

      // Exponential backoff: 2s, 4s, 8s
      await new Promise(resolve =>
        setTimeout(resolve, 2000 * Math.pow(2, attempt - 1))
      );
    }
  }

  throw new Error('Transcription failed');
}
```

### Audio Segmentation (`lib/segment-audio.ts`)

```typescript
import ffmpeg from 'fluent-ffmpeg';
import { getServiceSupabase } from '@/lib/supabase/service';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

interface AudioClip {
  type: 'word' | 'word_pair' | 'full';
  text: string;
  wordIndexStart: number;
  wordIndexEnd: number;
  startTime: number;
  endTime: number;
  durationMs: number;
  audioUrl: string;
}

export async function segmentAudioIntoClips(
  audioBlob: Blob,
  transcription: { words: { word: string; start: number; end: number }[] },
  expectedText: string
): Promise<AudioClip[]> {
  const clips: AudioClip[] = [];

  // Save audio to temp file
  const tempInput = join(tmpdir(), `input-${Date.now()}.mp3`);
  const buffer = await audioBlob.arrayBuffer();
  await writeFile(tempInput, Buffer.from(buffer));

  try {
    // Generate single-word clips
    for (let i = 0; i < transcription.words.length; i++) {
      const word = transcription.words[i];
      const clipUrl = await extractAndUploadClip(
        tempInput,
        word.start,
        word.end,
        `word_${i}`
      );

      clips.push({
        type: 'word',
        text: word.word,
        wordIndexStart: i,
        wordIndexEnd: i,
        startTime: word.start,
        endTime: word.end,
        durationMs: Math.round((word.end - word.start) * 1000),
        audioUrl: clipUrl,
      });
    }

    // Generate word-pair clips
    for (let i = 0; i < transcription.words.length - 1; i++) {
      const start = transcription.words[i].start;
      const end = transcription.words[i + 1].end;
      const clipUrl = await extractAndUploadClip(
        tempInput,
        start,
        end,
        `pair_${i}`
      );

      clips.push({
        type: 'word_pair',
        text: `${transcription.words[i].word} ${transcription.words[i + 1].word}`,
        wordIndexStart: i,
        wordIndexEnd: i + 1,
        startTime: start,
        endTime: end,
        durationMs: Math.round((end - start) * 1000),
        audioUrl: clipUrl,
      });
    }

    // Upload full audio
    const fullClipUrl = await uploadToStorage(audioBlob, 'full');
    clips.push({
      type: 'full',
      text: expectedText,
      wordIndexStart: 0,
      wordIndexEnd: transcription.words.length - 1,
      startTime: 0,
      endTime: transcription.words[transcription.words.length - 1]?.end || 0,
      durationMs: Math.round(
        (transcription.words[transcription.words.length - 1]?.end || 0) * 1000
      ),
      audioUrl: fullClipUrl,
    });

    return clips;

  } finally {
    // Clean up temp file
    await unlink(tempInput).catch(() => {});
  }
}

async function extractAndUploadClip(
  inputPath: string,
  startTime: number,
  endTime: number,
  clipName: string
): Promise<string> {
  const tempOutput = join(tmpdir(), `${clipName}-${Date.now()}.mp3`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(endTime - startTime)
      .output(tempOutput)
      .on('end', async () => {
        try {
          // Read output file
          const clipBuffer = await require('fs/promises').readFile(tempOutput);
          const clipBlob = new Blob([clipBuffer], { type: 'audio/mp3' });

          // Upload to Supabase
          const url = await uploadToStorage(clipBlob, clipName);

          // Clean up
          await unlink(tempOutput).catch(() => {});

          resolve(url);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject)
      .run();
  });
}

async function uploadToStorage(blob: Blob, name: string): Promise<string> {
  const supabase = getServiceSupabase();
  const fileName = `clips/${Date.now()}-${name}.mp3`;

  const { data, error } = await supabase.storage
    .from('reference-audio')
    .upload(fileName, blob);

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('reference-audio')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}
```

### Review Interface (`app/instructor/mantras/[id]/page.tsx`)

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface AudioClip {
  id: string;
  clip_type: string;
  text: string;
  audio_url: string;
  duration_ms: number;
}

export default function MantraReviewPage() {
  const params = useParams();
  const [mantra, setMantra] = useState<any>(null);
  const [clips, setClips] = useState<AudioClip[]>([]);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    fetchMantraData();
  }, [params.id]);

  async function fetchMantraData() {
    const res = await fetch(`/api/instructor/mantras/${params.id}`);
    const data = await res.json();
    setMantra(data.mantra);
    setClips(data.clips);
  }

  async function publishMantra() {
    setPublishing(true);

    await fetch('/api/instructor/publish-mantra', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mantraId: params.id }),
    });

    window.location.href = '/instructor/mantras';
  }

  const wordClips = clips.filter(c => c.clip_type === 'word');
  const pairClips = clips.filter(c => c.clip_type === 'word_pair');

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">{mantra?.title}</h1>
      <p className="text-gray-600 mb-6">{mantra?.text}</p>

      {/* Full Reference Audio */}
      <div className="mb-8 border rounded-lg p-4 bg-gray-50">
        <h2 className="text-xl font-semibold mb-3">Original Recording</h2>
        <audio src={mantra?.reference_audio_url} controls className="w-full" />
      </div>

      {/* Word Clips */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">
          Individual Word Clips ({wordClips.length})
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {wordClips.map(clip => (
            <div key={clip.id} className="border rounded p-3 bg-white">
              <p className="font-medium mb-2">{clip.text}</p>
              <audio src={clip.audio_url} controls className="w-full mb-1" />
              <p className="text-xs text-gray-500">{clip.duration_ms}ms</p>
            </div>
          ))}
        </div>
      </div>

      {/* Word Pair Clips */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-3">
          Word Pair Clips ({pairClips.length})
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {pairClips.map(clip => (
            <div key={clip.id} className="border rounded p-3 bg-white">
              <p className="font-medium mb-2">{clip.text}</p>
              <audio src={clip.audio_url} controls className="w-full mb-1" />
              <p className="text-xs text-gray-500">{clip.duration_ms}ms</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button
          onClick={publishMantra}
          disabled={publishing}
          className="flex-1 bg-green-600 text-white py-3 rounded font-medium hover:bg-green-700 disabled:bg-gray-300"
        >
          {publishing ? '⏳ Publishing...' : '✅ Publish to Students'}
        </button>
        <button
          onClick={() => window.location.href = '/instructor/mantras'}
          className="px-6 py-3 border rounded font-medium hover:bg-gray-50"
        >
          Back to List
        </button>
      </div>
    </div>
  );
}
```

## Error Handling

### Upload Validation

```typescript
export async function validateAudioFile(file: File): Promise<{
  valid: boolean;
  error?: string;
}> {
  // Check file size
  if (file.size > 10 * 1024 * 1024) {
    return { valid: false, error: 'File too large (max 10MB)' };
  }

  // Check MIME type
  const allowedTypes = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a'];
  if (!allowedTypes.includes(file.type)) {
    return { valid: false, error: 'Invalid format. Use MP3, WAV, or M4A' };
  }

  // Check file signature (magic bytes)
  const buffer = await file.slice(0, 4).arrayBuffer();
  const signature = new Uint8Array(buffer);

  const validSignatures = {
    mp3: [0xFF, 0xFB],
    wav: [0x52, 0x49],
    m4a: [0x66, 0x74],
  };

  const isValid = Object.values(validSignatures).some(
    sig => signature[0] === sig[0] && signature[1] === sig[1]
  );

  if (!isValid) {
    return { valid: false, error: 'Corrupted audio file' };
  }

  return { valid: true };
}
```

### Processing Retries

- Whisper API: 3 retries with exponential backoff (2s, 4s, 8s)
- On final failure: Email instructor with error details
- Job marked as `failed` with error_message and error_details

### User-Facing Error Messages

```typescript
const ERROR_MESSAGES = {
  UPLOAD_FAILED: 'Upload failed. Check your connection and try again.',
  FILE_TOO_LARGE: 'Audio file is too large. Maximum size is 10MB.',
  INVALID_FORMAT: 'Invalid audio format. Use MP3, WAV, or M4A.',
  CORRUPTED_FILE: 'Audio file appears to be corrupted.',
  TRANSCRIPTION_FAILED: 'Could not transcribe audio. Ensure clear pronunciation.',
  DUPLICATE_MANTRA: 'A mantra with this text already exists.',
  UNAUTHORIZED: 'You must be logged in as an instructor.',
};
```

## Environment Variables

```bash
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret-from-supabase-dashboard

# OpenAI
OPENAI_API_KEY=sk-...

# EmailJS
EMAILJS_SERVICE_ID=service_xxx
EMAILJS_PUBLIC_KEY=xxx
EMAILJS_WELCOME_TEMPLATE_ID=template_xxx
EMAILJS_RESET_TEMPLATE_ID=template_xxx

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Dependencies

```json
{
  "dependencies": {
    "next-auth": "^5.0.0-beta.25",
    "bcryptjs": "^2.4.3",
    "jose": "^5.0.0",
    "zod": "^3.0.0",
    "@emailjs/browser": "^4.3.3",
    "fluent-ffmpeg": "^2.1.2"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/fluent-ffmpeg": "^2.1.24"
  }
}
```

## Implementation Order

### Phase 1: Authentication (4-5 hours)

1. Database migrations
   - Create users, oauth_accounts, password_reset_tokens tables
   - Update mantras table with status, created_by columns
   - Add RLS policies

2. NextAuth setup
   - Configure auth.ts
   - Create middleware.ts
   - Add password utilities

3. Auth UI
   - Signup page
   - Login page
   - Password reset flow

4. EmailJS integration
   - Welcome email
   - Password reset email

### Phase 2: Instructor Upload (6-8 hours)

5. Upload interface
   - `/instructor/upload` page
   - Record/upload toggle
   - Form validation

6. Upload API
   - `/api/instructor/upload-mantra` endpoint
   - File validation
   - Supabase Storage upload

7. Processing pipeline
   - Whisper integration
   - Audio segmentation (ffmpeg)
   - Background job management

8. Review interface
   - `/instructor/mantras` list page
   - `/instructor/mantras/[id]` review page
   - Publish functionality

### Phase 3: Testing & Polish (3-4 hours)

9. Testing
   - Auth flows
   - Upload/process/publish workflow
   - RLS policy verification

10. Error handling
    - User-facing error messages
    - Email notifications for failures
    - Retry logic

11. Documentation
    - Update README
    - Add instructor guide

**Total Estimated Time: 15-20 hours**

## Testing Checklist

### Authentication
- [ ] User can sign up with email/password
- [ ] User can log in with email/password
- [ ] User can log in with Google OAuth
- [ ] Password reset email is sent
- [ ] Password reset link works
- [ ] Welcome email is sent on signup
- [ ] Middleware protects instructor routes
- [ ] RLS prevents users from seeing draft mantras

### Instructor Upload
- [ ] Instructor can record audio in-browser
- [ ] Instructor can upload audio file
- [ ] File validation rejects invalid formats
- [ ] File validation rejects files > 10MB
- [ ] Duplicate detection works
- [ ] Processing job is created
- [ ] Whisper transcribes audio correctly
- [ ] Word clips are generated
- [ ] Word pair clips are generated
- [ ] Full clip is stored
- [ ] Clips are visible on review page
- [ ] Publish changes status to 'published'
- [ ] Users can now see published mantra

### Error Handling
- [ ] Corrupted audio files are rejected
- [ ] Transcription failures are logged
- [ ] Instructor receives error email on failure
- [ ] Network errors show user-friendly messages
- [ ] Processing timeout is handled gracefully

## Security Considerations

1. **RLS Enforcement**: All tables have RLS policies to prevent unauthorized access
2. **Role Verification**: Middleware checks user role before allowing instructor actions
3. **File Validation**: Multi-layer validation (MIME type, magic bytes, size, duration)
4. **Token Expiry**: Password reset tokens expire after 1 hour
5. **Service Role Protection**: Service client never exposed to client-side code
6. **CORS**: API endpoints require proper authentication headers

## Performance Considerations

1. **Concurrent Processing Limit**: Max 3 processing jobs at once
2. **Chunked Uploads**: For future enhancement, support resumable uploads
3. **CDN for Audio**: Supabase Storage provides CDN for fast clip delivery
4. **Lazy Loading**: Clips load on-demand in review interface
5. **Background Processing**: Audio processing doesn't block user

## Future Enhancements

1. **Batch Upload**: Upload multiple mantras at once
2. **Re-record Individual Words**: Allow instructor to replace specific word clips
3. **Pronunciation Confidence Scores**: Show Whisper confidence for each word
4. **Automated Quality Checks**: Detect silent clips, too-short clips, etc.
5. **User Progress Dashboard**: Show instructor which mantras are most practiced
6. **Advanced Audio Editing**: Trim silence, normalize volume, etc.

---

**Next Steps:** Create implementation branch and begin Phase 1 (Authentication).
