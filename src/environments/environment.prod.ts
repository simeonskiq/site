export const environment = {
  production: true,
  apiUrl: 'http://localhost:4001', // Replace with your actual production API URL
  supabase: {
    url: 'https://jlsmvmycvnkfjqlicdrl.supabase.co',
    // Note: Supabase client-side key should be used in frontend if needed
    // For security, storage operations should go through the API server
  }
}; 