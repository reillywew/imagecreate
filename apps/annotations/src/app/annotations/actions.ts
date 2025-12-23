'use server';

// Note: File system writes don't work on Vercel's read-only production filesystem.
// This file is kept for potential future database integration.
// Currently, persistence is handled client-side via localStorage.

export async function saveAnnotationsToServer(annotations: unknown[]) {
  // In production, you would save to a database here
  // Example: Vercel Postgres, Supabase, MongoDB, etc.
  console.log('Server received annotations:', annotations.length);
  return { success: true, message: 'Annotations received (stored client-side)' };
}
