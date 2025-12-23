export const environment = {
  production: true,
  // Empty string means relative URLs (same domain) - correct for Vercel
  apiUrl: '',
  // Vercel Serverless doesn't support long-lived Socket.IO/WebSocket servers.
  // This app uses polling-based updates in production instead of Socket.IO.
  enableWebsocket: true,
  supabase: {
    url: 'https://jlsmvmycvnkfjqlicdrl.supabase.co',
  }
}; 