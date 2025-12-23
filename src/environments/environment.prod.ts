export const environment = {
  production: true,
  // Empty string means relative URLs (same domain) - correct for Vercel
  apiUrl: '',
  // Vercel Serverless doesn't support long-lived Socket.IO/WebSocket servers.
  // Use Supabase Realtime or host Socket.IO on a separate always-on server if needed.
  enableWebsocket: false,
  supabase: {
    url: 'https://jlsmvmycvnkfjqlicdrl.supabase.co',
  }
}; 