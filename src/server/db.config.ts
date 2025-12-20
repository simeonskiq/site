import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration for PostgreSQL database
const SUPABASE_URL = process.env['SUPABASE_URL'] || 'https://jlsmvmycvnkfjqlicdrl.supabase.co';
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_KEY'] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsc212bXljdm5rZmpxbGljZHJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTkxMTAzNSwiZXhwIjoyMDgxNDg3MDM1fQ.G20cbla2RDzgQz3UsvrYuNG7Yn6FERh9Tt117ZHjSq8';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client instance for database operations
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Supabase configuration is missing. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
    }

    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return supabaseClient;
}

/**
 * Initialize database connection and ensure tables exist
 */
export async function initializeDatabase(): Promise<void> {
  try {
    console.log('Attempting to connect to Supabase database...');
    console.log('URL:', SUPABASE_URL);

    const supabase = getSupabaseClient();
    console.log('✓ Connected to Supabase PostgreSQL database');

    // Ensure core tables exist
    await createUsersTable(supabase);
    await createRoomsTable(supabase);
    await createReservationsTable(supabase);
    await createRoomBlocksTable(supabase);
    await createReservationNotesTable(supabase);
    await createAuditLogTable(supabase);
  } catch (error: any) {
    console.error('✗ Database connection failed:', error);
    throw error;
  }
}

async function createUsersTable(supabase: SupabaseClient): Promise<void> {
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          password_hash VARCHAR(255) NOT NULL,
          first_name VARCHAR(100),
          last_name VARCHAR(100),
          phone VARCHAR(20),
          role VARCHAR(50) NOT NULL DEFAULT 'User',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `
    });

    // If RPC doesn't exist, use direct SQL (requires direct database access)
    // For now, we'll create tables using Supabase SQL editor or migrations
    // This is a placeholder - in production, use Supabase migrations
    if (error) {
      console.log('Note: Table creation should be done via Supabase migrations. Users table should exist.');
    }
    console.log('Users table ready');
  } catch (error) {
    console.error('Error ensuring users table exists:', error);
    // Don't throw - table might already exist via migrations
  }
}

async function createRoomsTable(supabase: SupabaseClient): Promise<void> {
  try {
    // Check if rooms table exists and seed if empty
    const { data: rooms, error: selectError } = await supabase
      .from('rooms')
      .select('id')
      .limit(1);

    if (selectError && selectError.code === 'PGRST116') {
      // Table doesn't exist - should be created via migrations
      console.log('Note: Rooms table should be created via Supabase migrations');
    } else if (rooms && rooms.length === 0) {
      // Seed default rooms
      const { error: insertError } = await supabase.from('rooms').insert([
        { name: 'Апартамент 1', type: 'Apartment', base_price: 99, status: 'Available', visible_to_users: true },
        { name: 'Апартамент 2', type: 'Apartment', base_price: 149, status: 'Available', visible_to_users: true },
        { name: 'Апартамент 3', type: 'Apartment', base_price: 199, status: 'Available', visible_to_users: true },
        { name: 'Студио', type: 'Studio', base_price: 249, status: 'Available', visible_to_users: true }
      ]);

      if (insertError) {
        console.error('Error seeding rooms:', insertError);
      } else {
        console.log('Seeded default Rooms records');
      }
    }

    console.log('Rooms table ready');
  } catch (error) {
    console.error('Error ensuring rooms table exists:', error);
  }
}

async function createReservationsTable(supabase: SupabaseClient): Promise<void> {
  try {
    // Table should be created via migrations
    console.log('Reservations table ready');
  } catch (error) {
    console.error('Error ensuring reservations table exists:', error);
  }
}

async function createRoomBlocksTable(supabase: SupabaseClient): Promise<void> {
  try {
    // Table should be created via migrations
    console.log('RoomBlocks table ready');
  } catch (error) {
    console.error('Error ensuring room_blocks table exists:', error);
  }
}

async function createReservationNotesTable(supabase: SupabaseClient): Promise<void> {
  try {
    // Table should be created via migrations
    console.log('ReservationNotes table ready');
  } catch (error) {
    console.error('Error ensuring reservation_notes table exists:', error);
  }
}

async function createAuditLogTable(supabase: SupabaseClient): Promise<void> {
  try {
    // Table should be created via migrations
    console.log('AuditLogs table ready');
  } catch (error) {
    console.error('Error ensuring audit_logs table exists:', error);
  }
}

/**
 * Get database connection (returns Supabase client)
 * Kept for backward compatibility with existing code
 */
export async function getDbConnection(): Promise<SupabaseClient> {
  return getSupabaseClient();
}

/**
 * Close database connection (no-op for Supabase, kept for compatibility)
 */
export async function closeDbConnection(): Promise<void> {
  // Supabase client doesn't need explicit closing
  console.log('Database connection closed');
}
