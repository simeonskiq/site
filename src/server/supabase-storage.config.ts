import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration - using only for storage, not database
const SUPABASE_URL = process.env['SUPABASE_URL'] || 'https://jlsmvmycvnkfjqlicdrl.supabase.co';
const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_KEY'] || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsc212bXljdm5rZmpxbGljZHJsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTkxMTAzNSwiZXhwIjoyMDgxNDg3MDM1fQ.G20cbla2RDzgQz3UsvrYuNG7Yn6FERh9Tt117ZHjSq8'; // Service role key for server-side operations

let supabaseClient: SupabaseClient | null = null;

/**
 * Get Supabase client instance (storage only)
 * This client is used exclusively for file storage operations
 * Returns null if Supabase is not configured (allows app to run without storage)
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return null;
  }

  if (!supabaseClient) {
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
 * Storage bucket names - customize as needed
 */
export const STORAGE_BUCKETS = {
  ROOM_IMAGES: 'room-images',
  USER_AVATARS: 'user-avatars',
  DOCUMENTS: 'documents',
  GENERAL: 'general'
} as const;

/**
 * Initialize storage buckets if they don't exist
 * This should be called once during application startup
 */
export async function initializeStorageBuckets(): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      console.log('⚠ Supabase not configured - storage functionality disabled');
      return;
    }

    // Check and create buckets if they don't exist
    for (const [key, bucketName] of Object.entries(STORAGE_BUCKETS)) {
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();

      if (listError) {
        console.error(`Error listing buckets: ${listError.message}`);
        continue;
      }

      const bucketExists = buckets?.some((b) => b.name === bucketName);

      if (!bucketExists) {
        const { data, error } = await supabase.storage.createBucket(bucketName, {
          public: true, // Make buckets public for easy access
          fileSizeLimit: 52428800, // 50MB limit
          allowedMimeTypes: key === 'ROOM_IMAGES' || key === 'USER_AVATARS' 
            ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
            : undefined
        });

        if (error) {
          console.error(`Error creating bucket ${bucketName}:`, error.message);
        } else {
          console.log(`✓ Created storage bucket: ${bucketName}`);
        }
      } else {
        console.log(`✓ Storage bucket exists: ${bucketName}`);
      }
    }
  } catch (error: any) {
    console.error('Error initializing storage buckets:', error.message);
    // Don't throw - allow app to continue even if storage setup fails
  }
}

/**
 * Upload a file to Supabase storage
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: Buffer | Uint8Array,
  contentType?: string,
  options?: {
    upsert?: boolean;
    cacheControl?: string;
  }
): Promise<{ path: string; url: string }> {
  const supabase = getSupabaseClient();
  
  if (!supabase) {
    throw new Error('Supabase storage is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType: contentType || 'application/octet-stream',
      upsert: options?.upsert ?? false,
      cacheControl: options?.cacheControl || '3600'
    });

  if (error) {
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return {
    path: data.path,
    url: urlData.publicUrl
  };
}

/**
 * Delete a file from Supabase storage
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  if (!supabase) {
    throw new Error('Supabase storage is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  }

  const { error } = await supabase.storage.from(bucket).remove([path]);

  if (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Get public URL for a file
 */
export function getPublicUrl(bucket: string, path: string): string {
  const supabase = getSupabaseClient();
  
  if (!supabase) {
    throw new Error('Supabase storage is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  }
  
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * List files in a bucket (with optional path prefix)
 */
export async function listFiles(
  bucket: string,
  path?: string,
  options?: {
    limit?: number;
    offset?: number;
    sortBy?: { column: string; order: 'asc' | 'desc' };
  }
): Promise<Array<{ name: string; id: string; updated_at: string; created_at: string; last_accessed_at: string; metadata: Record<string, any> }>> {
  const supabase = getSupabaseClient();
  
  if (!supabase) {
    throw new Error('Supabase storage is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.');
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .list(path || '', {
      limit: options?.limit,
      offset: options?.offset,
      sortBy: options?.sortBy
    });

  if (error) {
    throw new Error(`Failed to list files: ${error.message}`);
  }

  return data || [];
}

