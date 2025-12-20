export const environment = {
  production: true,
  apiUrl: '', // Use relative URLs - API routes are handled by the same server
  supabase: {
    url: 'https://jlsmvmycvnkfjqlicdrl.supabase.co',
    // Note: Supabase client-side key should be used in frontend if needed
    // For security, storage operations should go through the API server
  }
}; 