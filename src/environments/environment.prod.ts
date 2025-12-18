export const environment = {
  production: true,
  apiUrl: 'https://jlsmvmycvnkfjqlicdrl.supabase.co', // Replace with your actual production API URL
  supabase: {
    url: process.env['SUPABASE_URL'] || '',
    // Note: Supabase client-side key should be used in frontend if needed
    // For security, storage operations should go through the API server
  }
}; 