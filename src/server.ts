import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDbConnection } from './server/db.config.js';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// CORS middleware for API routes
// Enhanced CORS configuration per article recommendations
app.use((req, res, next): void => {
  // Only apply CORS to API routes
  if (req.path.startsWith('/api/')) {
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, DELETE, PATCH, POST, PUT, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Origin');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
  }
  next();
});

// Middleware for parsing JSON - CRITICAL: Must be before route handlers
// This ensures POST request bodies are parsed correctly
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CRITICAL: Log all POST requests to debug Vercel routing issues
app.use((req, res, next) => {
  if (req.method === 'POST' && (req.path.startsWith('/api/') || req.url?.startsWith('/api/'))) {
    console.log('[POST REQUEST DEBUG]', {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      headers: req.headers
    });
  }
  next();
});

// Debug middleware for API routes (can be removed in production)
// IMPORTANT: This must come BEFORE route definitions to log all API requests
app.use('/api/*', (req, res, next) => {
  console.log(`[API Middleware] ${req.method} ${req.path} ${req.url} ${req.originalUrl}`);
  next();
});

// JWT secret key (in production, use environment variable)
const JWT_SECRET = process.env['JWT_SECRET'] || 'npUtks96Wbo1f8mJYd2z1A/79vQPQIaDzbBcQe3GEnsAgFB3xP4rMebrMRYCVw3BiHZfe2LzEFY5F0IXgCZOhA==';

interface JwtPayload {
  userId: number;
  email: string;
  role: string;
}

interface AuthRequest extends express.Request {
  user?: JwtPayload;
}

const authMiddleware: express.RequestHandler = async (
  req: AuthRequest,
  res: express.Response,
  next: express.NextFunction
) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring('Bearer '.length);
  try {
    // jwtVerify works with Edge runtime - encode secret as Uint8Array
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    // Cast through unknown first to satisfy TypeScript type checking
    (req as AuthRequest).user = payload as unknown as JwtPayload;
    next();
    return;
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
};

const requireRole = (allowedRoles: string[]) => {
  const middleware: express.RequestHandler = (
    req: AuthRequest,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const role = req.user?.role;
    if (!role) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Role mapping in DB: User, Support, Manager, SuperAdmin
    if (!allowedRoles.includes(role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };

  return middleware;
};

async function logAudit(
  userId: number,
  action: string,
  entityType: string,
  entityId: number,
  details?: string
): Promise<void> {
  try {
    const supabase = await getDbConnection();
    await supabase
      .from('audit_logs')
      .insert({
        user_id: userId,
        action: action,
        entity_type: entityType,
        entity_id: entityId,
        details: details || null
      });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

/**
 * API Routes for Authentication
 */

// Registration endpoint
app.post('/api/auth/register', async (req, res): Promise<void> => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    const supabase = await getDbConnection();

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      res.status(409).json({ error: 'User with this email already exists' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new user
    const { data: user, error: insertError } = await supabase
      .from('users')
      .insert({
        email: email,
        password_hash: passwordHash,
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null
      })
      .select('id, email, first_name, last_name, phone, created_at')
      .single();

    if (insertError || !user) {
      throw insertError || new Error('Failed to create user');
    }

    // Generate JWT token using jose (Edge runtime compatible)
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 24 * 7; // 7 days
    const token = await new SignJWT({ userId: user.id, email: user.email } as JWTPayload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setExpirationTime(exp)
      .setIssuedAt(iat)
      .setNotBefore(iat)
      .sign(new TextEncoder().encode(JWT_SECRET));

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone
      },
      token
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Login endpoint - must be defined before catch-all routes
// Using app.post() explicitly to ensure POST method is handled
app.post('/api/auth/login', async (req, res): Promise<void> => {
  console.log('[LOGIN HANDLER] POST /api/auth/login received', { 
    method: req.method, 
    path: req.path,
    url: req.url,
    originalUrl: req.originalUrl,
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : []
  });
  
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const supabase = await getDbConnection();

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, password_hash, first_name, last_name, phone, role, created_at')
      .eq('email', email)
      .single();

    if (userError || !user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate JWT token using jose (Edge runtime compatible)
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role || 'User'
    };

    // Generate JWT token using jose (Edge runtime compatible)
    const iat = Math.floor(Date.now() / 1000);
    const exp = iat + 60 * 60 * 24 * 7; // 7 days
    const token = await new SignJWT(tokenPayload as JWTPayload)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setExpirationTime(exp)
      .setIssuedAt(iat)
      .setNotBefore(iat)
      .sign(new TextEncoder().encode(JWT_SECRET));

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role
      },
      token
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res): void => {
  res.json({ status: 'ok', message: 'API server is running' });
});

// Test endpoint to verify API routing works
app.get('/api/test', (req, res): void => {
  res.json({ message: 'API routes are working', method: req.method, path: req.path });
});

// Test POST endpoint to verify POST routing works
app.post('/api/test', (req, res): void => {
  res.json({ message: 'POST API routes are working', method: req.method, path: req.path, body: req.body });
});

/**
 * User profile endpoints
 */
app.get('/api/user/profile', authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const supabase = await getDbConnection();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, role')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to load profile', details: error.message });
  }
});

app.put('/api/user/profile', authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { firstName, lastName, phone } = req.body as {
      firstName?: string;
      lastName?: string;
      phone?: string;
    };

    const supabase = await getDbConnection();
    const { data: user, error } = await supabase
      .from('users')
      .update({
        first_name: firstName || null,
        last_name: lastName || null,
        phone: phone || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.userId)
      .select('id, email, first_name, last_name, phone, role')
      .single();

    if (error || !user) {
      throw error || new Error('Failed to update user');
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

app.put('/api/user/email', authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const supabase = await getDbConnection();

    // Ensure email is not already taken
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .neq('id', req.user.userId)
      .single();

    if (existingUser) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({
        email: email,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.userId)
      .select('id, email, first_name, last_name, phone, role')
      .single();

    if (error || !user) {
      throw error || new Error('Failed to update email');
    }

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role
    });
  } catch (error: any) {
    console.error('Update email error:', error);
    res.status(500).json({ error: 'Failed to update email', details: error.message });
  }
});

app.put('/api/user/password', authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current and new password are required' });
      return;
    }
    if (newPassword.length < 6) {
      res
        .status(400)
        .json({ error: 'New password must be at least 6 characters long' });
      return;
    }

    const supabase = await getDbConnection();
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', req.user.userId)
      .single();

    if (userError || !dbUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, dbUser.password_hash);
    if (!isValid) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', req.user.userId);

    if (updateError) {
      throw updateError;
    }

    res.json({ message: 'Password updated successfully' });
  } catch (error: any) {
    console.error('Update password error:', error);
    res.status(500).json({ error: 'Failed to update password', details: error.message });
  }
});

/**
 * Authenticated endpoint: get reservations for the logged-in user.
 */
app.get('/api/user/reservations', authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const supabase = await getDbConnection();
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select(`
        id,
        room_id,
        start_date,
        end_date,
        status,
        total_price,
        guest_first_name,
        guest_last_name,
        guest_email,
        guest_phone,
        notes,
        created_at,
        canceled_at,
        canceled_by
      `)
      .eq('user_id', req.user.userId)
      .order('start_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // PostgREST embedded relations (rooms:room_id) require FK constraints in Supabase.
    // To avoid 500s when FKs aren't configured, do a manual join in code.
    const roomIds = Array.from(
      new Set((reservations || []).map((r: any) => r.room_id).filter((id: any) => id != null))
    );

    let roomsById = new Map<number, any>();
    if (roomIds.length > 0) {
      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('id, name, type, base_price')
        .in('id', roomIds);

      if (roomsError) {
        throw roomsError;
      }

      roomsById = new Map((rooms || []).map((r: any) => [r.id, r]));
    }

    // Transform the data to match expected format
    const transformed = (reservations || []).map((r: any) => {
      const room = roomsById.get(r.room_id);
      return {
        Id: r.id,
        RoomId: r.room_id,
        StartDate: r.start_date,
        EndDate: r.end_date,
        Status: r.status,
        TotalPrice: r.total_price,
        GuestFirstName: r.guest_first_name,
        GuestLastName: r.guest_last_name,
        GuestEmail: r.guest_email,
        GuestPhone: r.guest_phone,
        Notes: r.notes,
        CreatedAt: r.created_at,
        CanceledAt: r.canceled_at,
        CanceledBy: r.canceled_by,
        RoomName: room?.name,
        RoomType: room?.type,
        BasePrice: room?.base_price
      };
    });

    res.json(transformed);
  } catch (error: any) {
    console.error('User reservations error:', error);
    res.status(500).json({
      error: 'Failed to load reservations',
      code: error?.code,
      details: error?.message || error?.details || String(error)
    });
  }
});

/**
 * Authenticated endpoint: cancel a reservation (user can only cancel their own).
 */
app.put('/api/user/reservations/:id/cancel', authMiddleware, async (req: AuthRequest, res): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const reservationId = Number(req.params['id']);
    const supabase = await getDbConnection();
    
    // First verify the reservation belongs to this user
    const { data: reservation, error: checkError } = await supabase
      .from('reservations')
      .select('id, status')
      .eq('id', reservationId)
      .eq('user_id', req.user.userId)
      .single();

    if (checkError || !reservation) {
      res.status(404).json({ error: 'Reservation not found or you do not have permission to cancel it' });
      return;
    }
    
    // Don't allow canceling already canceled or completed reservations
    if (reservation.status === 'Cancelled' || reservation.status === 'Completed') {
      res.status(400).json({ error: `Cannot cancel a reservation with status: ${reservation.status}` });
      return;
    }

    // Don't allow users to cancel approved reservations
    if (reservation.status === 'Approved') {
      res.status(400).json({ error: 'Cannot cancel an approved reservation. Please contact support.' });
      return;
    }

    // Update status to Cancelled and set CanceledAt timestamp and CanceledBy
    const { data: cancelledReservation, error: updateError } = await supabase
      .from('reservations')
      .update({
        status: 'Cancelled',
        canceled_at: new Date().toISOString(),
        canceled_by: 'User',
        updated_at: new Date().toISOString()
      })
      .eq('id', reservationId)
      .select()
      .single();

    if (updateError || !cancelledReservation) {
      throw updateError || new Error('Failed to cancel reservation');
    }

    res.json(cancelledReservation);
  } catch (error: any) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({ error: 'Failed to cancel reservation', details: error.message });
  }
});

/**
 * Public endpoint: get available rooms for a date range.
 */
app.get('/api/public/available-rooms', async (req, res): Promise<void> => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    if (!startDate || !endDate) {
      res.status(400).json({ error: 'startDate and endDate are required' });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      res.status(400).json({ error: 'Invalid dates. End date must be after start date.' });
      return;
    }

    const supabase = await getDbConnection();
    
    // Get all available rooms
    const { data: allRooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*')
      .eq('visible_to_users', true)
      .eq('status', 'Available')
      .order('name');

    if (roomsError) {
      throw roomsError;
    }

    // Get conflicting reservations
    const { data: conflictingReservations, error: resError } = await supabase
      .from('reservations')
      .select('room_id')
      .in('status', ['Approved', 'Completed'])
      .neq('status', 'Cancelled')
      .lt('start_date', endDate)
      .gt('end_date', startDate);

    if (resError) {
      throw resError;
    }

    // Get conflicting blocks
    const { data: allBlocks, error: blocksError } = await supabase
      .from('room_blocks')
      .select('room_id, is_permanent, start_date, end_date');

    if (blocksError) {
      throw blocksError;
    }

    // Filter blocks that conflict with the date range
    const conflictingBlocks = allBlocks?.filter(b => 
      b.is_permanent || (b.start_date < endDate && b.end_date > startDate)
    ) || [];

    // Filter out rooms with conflicts
    const conflictingRoomIds = new Set([
      ...(conflictingReservations?.map(r => r.room_id) || []),
      ...(conflictingBlocks?.map(b => b.room_id) || [])
    ]);

    const availableRooms = allRooms?.filter(room => !conflictingRoomIds.has(room.id)) || [];

    // Transform to match expected format
    const transformed = availableRooms.map((r: any) => ({
      Id: r.id,
      Name: r.name,
      Type: r.type,
      BasePrice: r.base_price,
      Status: r.status,
      VisibleToUsers: r.visible_to_users,
      VisibilityRole: r.visibility_role,
      HasUnresolvedMaintenance: r.has_unresolved_maintenance,
      CreatedAt: r.created_at,
      UpdatedAt: r.updated_at
    }));

    res.json(transformed);
  } catch (error: any) {
    console.error('Available rooms error:', error);
    res.status(500).json({ error: 'Failed to load available rooms', details: error.message });
  }
});

/**
 * Public reservation endpoint used by the booking page.
 */
app.post('/api/public/reservations', async (req, res): Promise<void> => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      roomId,
      roomName,
      startDate,
      endDate,
      pricePerNight,
      notes,
      userId
    } = req.body as {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      roomId?: number;
      roomName?: string;
      startDate?: string;
      endDate?: string;
      pricePerNight?: number;
      notes?: string;
      userId?: number;
    };

    // Email is required; phone is optional
    if (!firstName || !lastName || !email || !startDate || !endDate) {
      res.status(400).json({ error: 'Missing required reservation data' });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      res.status(400).json({ error: 'Invalid dates. End date must be after start date.' });
      return;
    }

    const nights = Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalPrice =
      pricePerNight && nights > 0 ? pricePerNight * nights : null;

    const supabase = await getDbConnection();
    const { data: reservation, error: insertError } = await supabase
      .from('reservations')
      .insert({
        user_id: userId ?? null,
        room_id: roomId ?? null,
        start_date: startDate,
        end_date: endDate,
        status: 'Pending',
        total_price: totalPrice,
        guest_first_name: firstName,
        guest_last_name: lastName,
        guest_email: email,
        guest_phone: phone || null,
        notes: notes || null
      })
      .select()
      .single();

    if (insertError || !reservation) {
      throw insertError || new Error('Failed to create reservation');
    }

    res.status(201).json({
      message: 'Reservation request stored successfully',
      reservation
    });
  } catch (error: any) {
    console.error('Public reservation error:', error);
    res
      .status(500)
      .json({ error: 'Failed to store reservation', details: error.message });
  }
});

/**
 * Admin APIs
 * All prefixed with /api/admin and protected by auth + role
 */

// Simple dashboard overview
app.get(
  '/api/admin/dashboard',
  authMiddleware,
  requireRole(['Manager', 'SuperAdmin', 'Support']),
  async (req: AuthRequest, res) => {
    try {
      const supabase = await getDbConnection();

      const [pendingReservations, reservations, rooms, blockedRooms] = await Promise.all([
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Pending'),
        supabase
          .from('reservations')
          .select('id, status, start_date, end_date, room_id')
          .in('status', ['Approved', 'Completed']),
        supabase
          .from('rooms')
          .select('id'),
        supabase
          .from('room_blocks')
          .select('room_id, is_permanent, start_date, end_date')
      ]);

      const today = new Date().toISOString().split('T')[0];
      const activeReservations = reservations.data?.filter(r => 
        r.start_date <= today && r.end_date >= today
      ) || [];
      const occupancyRate = rooms.data && rooms.data.length > 0 
        ? activeReservations.length / rooms.data.length 
        : 0;

      const activeBlocks = blockedRooms.data?.filter(b => 
        b.is_permanent || (b.start_date <= today && b.end_date >= today)
      ) || [];
      const uniqueBlockedRooms = new Set(activeBlocks.map(b => b.room_id));

      res.json({
        totalPendingReservations: pendingReservations.count || 0,
        occupancyRate: occupancyRate,
        blockedRoomsCount: uniqueBlockedRooms.size
      });
    } catch (error: any) {
      console.error('Dashboard error:', error);
      res.status(500).json({ error: 'Failed to load dashboard', details: error.message });
    }
  }
);

// List reservations with optional filters
app.get(
  '/api/admin/reservations',
  authMiddleware,
  requireRole(['Manager', 'SuperAdmin', 'Support']),
  async (req: AuthRequest, res) => {
    try {
      const supabase = await getDbConnection();
      const { status, userId, roomId } = req.query;

      let query = supabase
        .from('reservations')
        .select(`
          id,
          user_id,
          room_id,
          start_date,
          end_date,
          status,
          total_price,
          guest_first_name,
          guest_last_name,
          guest_email,
          guest_phone,
          created_at,
          canceled_at,
          canceled_by
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status as string);
      }

      if (userId) {
        query = query.eq('user_id', Number(userId));
      }

      if (roomId) {
        query = query.eq('room_id', Number(roomId));
      }

      const { data: reservations, error } = await query;

      if (error) {
        throw error;
      }

      const userIds = Array.from(
        new Set((reservations || []).map((r: any) => r.user_id).filter((id: any) => id != null))
      );
      const roomIds = Array.from(
        new Set((reservations || []).map((r: any) => r.room_id).filter((id: any) => id != null))
      );

      let usersById = new Map<number, any>();
      if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, email, first_name, last_name')
          .in('id', userIds);
        if (usersError) throw usersError;
        usersById = new Map((users || []).map((u: any) => [u.id, u]));
      }

      let roomsById = new Map<number, any>();
      if (roomIds.length > 0) {
        const { data: rooms, error: roomsError } = await supabase
          .from('rooms')
          .select('id, name')
          .in('id', roomIds);
        if (roomsError) throw roomsError;
        roomsById = new Map((rooms || []).map((r: any) => [r.id, r]));
      }

      // Transform data to match expected format
      const transformed = (reservations || []).map((r: any) => {
        const user = usersById.get(r.user_id);
        const room = roomsById.get(r.room_id);
        return {
          Id: r.id,
          UserId: r.user_id,
          RoomId: r.room_id,
          StartDate: r.start_date,
          EndDate: r.end_date,
          Status: r.status,
          TotalPrice: r.total_price,
          GuestFirstName: r.guest_first_name,
          GuestLastName: r.guest_last_name,
          GuestEmail: r.guest_email,
          GuestPhone: r.guest_phone,
          CreatedAt: r.created_at,
          CanceledAt: r.canceled_at,
          CanceledBy: r.canceled_by,
          Email: user?.email || r.guest_email,
          FirstName: user?.first_name || r.guest_first_name,
          LastName: user?.last_name || r.guest_last_name,
          RoomName: room?.name,
          DisplayStatus:
            r.status === 'Cancelled' && r.canceled_by === 'User'
              ? 'Canceled by user'
              : r.status === 'Cancelled' && r.canceled_by === 'Admin'
                ? 'Canceled by admin'
                : r.status
        };
      });

      res.json(transformed);
    } catch (error: any) {
      console.error('List reservations error:', error);
      res
        .status(500)
        .json({
          error: 'Failed to load reservations',
          code: error?.code,
          details: error?.message || error?.details || String(error)
        });
    }
  }
);

// Change reservation status (approve / reject / cancel / complete)
app.post(
  '/api/admin/reservations/:id/status',
  authMiddleware,
  requireRole(['Support', 'Manager', 'SuperAdmin']),
  async (req: AuthRequest, res): Promise<void> => {
    const reservationId = Number(req.params['id']);
    const { status } = req.body as { status?: string };

    if (
      !status ||
      !['Pending', 'Approved', 'Rejected', 'Cancelled', 'Completed'].includes(status)
    ) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    try {
      const supabase = await getDbConnection();
      
      // Prepare update data
      const updateData: any = {
        status: status,
        updated_at: new Date().toISOString()
      };
      
      if (status === 'Cancelled') {
        updateData.canceled_by = 'Admin';
        updateData.canceled_at = new Date().toISOString();
      }
      
      // Update reservation
      const { data: updatedReservation, error: updateError } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId)
        .select()
        .single();

      if (updateError || !updatedReservation) {
        res.status(404).json({ error: 'Reservation not found' });
        return;
      }

      if (req.user) {
        await logAudit(
          req.user.userId,
          `Changed reservation status to ${status}`,
          'Reservation',
          reservationId
        );
      }

      // Transform to match expected format
      const transformed = {
        Id: updatedReservation.id,
        UserId: updatedReservation.user_id,
        RoomId: updatedReservation.room_id,
        StartDate: updatedReservation.start_date,
        EndDate: updatedReservation.end_date,
        Status: updatedReservation.status,
        TotalPrice: updatedReservation.total_price,
        GuestFirstName: updatedReservation.guest_first_name,
        GuestLastName: updatedReservation.guest_last_name,
        GuestEmail: updatedReservation.guest_email,
        GuestPhone: updatedReservation.guest_phone,
        Notes: updatedReservation.notes,
        CreatedAt: updatedReservation.created_at,
        CanceledAt: updatedReservation.canceled_at,
        CanceledBy: updatedReservation.canceled_by
      };

      res.json(transformed);
    } catch (error: any) {
      console.error('Update reservation status error:', error);
      res
        .status(500)
        .json({ error: 'Failed to update reservation status', details: error.message });
    }
  }
);

// Add internal note to reservation
app.post(
  '/api/admin/reservations/:id/notes',
  authMiddleware,
  requireRole(['Support', 'Manager', 'SuperAdmin']),
  async (req: AuthRequest, res): Promise<void> => {
    const reservationId = Number(req.params['id']);
    const { note } = req.body as { note?: string };

    if (!note || !note.trim()) {
      res.status(400).json({ error: 'Note is required' });
      return;
    }

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    try {
      const supabase = await getDbConnection();
      const { data: noteRecord, error: insertError } = await supabase
        .from('reservation_notes')
        .insert({
          reservation_id: reservationId,
          note: note,
          created_by_user_id: req.user.userId
        })
        .select()
        .single();

      if (insertError || !noteRecord) {
        throw insertError || new Error('Failed to add note');
      }

      await logAudit(
        req.user.userId,
        'Added internal note',
        'Reservation',
        reservationId,
        note
      );

      // Transform to match expected format
      const transformed = {
        Id: noteRecord.id,
        ReservationId: noteRecord.reservation_id,
        Note: noteRecord.note,
        CreatedByUserId: noteRecord.created_by_user_id,
        CreatedAt: noteRecord.created_at
      };

      res.status(201).json(transformed);
    } catch (error: any) {
      console.error('Add reservation note error:', error);
      res
        .status(500)
        .json({ error: 'Failed to add note', details: error.message });
    }
  }
);

// Modify reservation dates or room
app.put(
  '/api/admin/reservations/:id',
  authMiddleware,
  requireRole(['Manager', 'SuperAdmin']),
  async (req: AuthRequest, res): Promise<void> => {
    const reservationId = Number(req.params['id']);
    const { startDate, endDate, roomId } = req.body as {
      startDate?: string;
      endDate?: string;
      roomId?: number;
    };

    if (!startDate && !endDate && !roomId) {
      res.status(400).json({ error: 'Nothing to update. Provide startDate, endDate or roomId.' });
      return;
    }

    try {
      const supabase = await getDbConnection();
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (startDate) {
        updateData.start_date = startDate;
      }
      if (endDate) {
        updateData.end_date = endDate;
      }
      if (roomId) {
        updateData.room_id = roomId;
      }

      const { data: reservation, error: updateError } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId)
        .select()
        .single();

      if (updateError || !reservation) {
        res.status(404).json({ error: 'Reservation not found' });
        return;
      }

      if (req.user) {
        await logAudit(
          req.user.userId,
          'Modified reservation',
          'Reservation',
          reservationId,
          JSON.stringify({ startDate, endDate, roomId })
        );
      }

      // Transform to match expected format
      const transformed = {
        Id: reservation.id,
        UserId: reservation.user_id,
        RoomId: reservation.room_id,
        StartDate: reservation.start_date,
        EndDate: reservation.end_date,
        Status: reservation.status,
        TotalPrice: reservation.total_price,
        GuestFirstName: reservation.guest_first_name,
        GuestLastName: reservation.guest_last_name,
        GuestEmail: reservation.guest_email,
        GuestPhone: reservation.guest_phone,
        Notes: reservation.notes,
        CreatedAt: reservation.created_at,
        CanceledAt: reservation.canceled_at,
        CanceledBy: reservation.canceled_by
      };

      res.json(transformed);
    } catch (error: any) {
      console.error('Modify reservation error:', error);
      res
        .status(500)
        .json({ error: 'Failed to modify reservation', details: error.message });
    }
  }
);

// Rooms management / visibility / blocking
app.get(
  '/api/admin/rooms',
  authMiddleware,
  requireRole(['Support', 'Manager', 'SuperAdmin']),
  async (req: AuthRequest, res) => {
    try {
      const supabase = await getDbConnection();
      const today = new Date().toISOString().split('T')[0];

      const { data: rooms, error: roomsError } = await supabase
        .from('rooms')
        .select('*')
        .order('name');

      const { data: blocks, error: blocksError } = await supabase
        .from('room_blocks')
        .select('room_id, is_permanent, start_date, end_date');

      if (roomsError || blocksError) {
        throw roomsError || blocksError;
      }

      // Check which rooms are currently blocked
      const blockedRoomIds = new Set(
        blocks?.filter(b => 
          b.is_permanent || (b.start_date <= today && b.end_date >= today)
        ).map(b => b.room_id) || []
      );

      // Transform to match expected format
      const transformed = rooms?.map((r: any) => ({
        Id: r.id,
        Name: r.name,
        Type: r.type,
        BasePrice: r.base_price,
        Status: r.status,
        VisibleToUsers: r.visible_to_users,
        VisibilityRole: r.visibility_role,
        HasUnresolvedMaintenance: r.has_unresolved_maintenance,
        CreatedAt: r.created_at,
        UpdatedAt: r.updated_at,
        IsCurrentlyBlocked: blockedRoomIds.has(r.id) ? 1 : 0
      })) || [];

      res.json(transformed);
    } catch (error: any) {
      console.error('List rooms error:', error);
      res.status(500).json({ error: 'Failed to load rooms', details: error.message });
    }
  }
);

app.post(
  '/api/admin/rooms/:id/status',
  authMiddleware,
  requireRole(['Manager', 'SuperAdmin']),
  async (req: AuthRequest, res): Promise<void> => {
    const roomId = Number(req.params['id']);
    const { status } = req.body as { status?: string };

    if (!status || !['Available', 'Reserved', 'Blocked', 'Maintenance'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }

    try {
      const supabase = await getDbConnection();
      const { data: updatedRoom, error: updateError } = await supabase
        .from('rooms')
        .update({
          status: status,
          updated_at: new Date().toISOString()
        })
        .eq('id', roomId)
        .select()
        .single();

      if (updateError || !updatedRoom) {
        res.status(404).json({ error: 'Room not found' });
        return;
      }

      if (req.user) {
        await logAudit(req.user.userId, `Changed room status to ${status}`, 'Room', roomId);
      }

      // Transform to match expected format
      const transformed = {
        Id: updatedRoom.id,
        Name: updatedRoom.name,
        Type: updatedRoom.type,
        BasePrice: updatedRoom.base_price,
        Status: updatedRoom.status,
        VisibleToUsers: updatedRoom.visible_to_users,
        VisibilityRole: updatedRoom.visibility_role,
        HasUnresolvedMaintenance: updatedRoom.has_unresolved_maintenance,
        CreatedAt: updatedRoom.created_at,
        UpdatedAt: updatedRoom.updated_at
      };

      res.json(transformed);
    } catch (error: any) {
      console.error('Update room status error:', error);
      res
        .status(500)
        .json({ error: 'Failed to update room status', details: error.message });
    }
  }
);

// Block room for specific dates or permanently
app.post(
  '/api/admin/rooms/:id/block',
  authMiddleware,
  requireRole(['Manager', 'SuperAdmin']),
  async (req: AuthRequest, res): Promise<void> => {
    const roomId = Number(req.params['id']);
    const { startDate, endDate, isPermanent, reason } = req.body as {
      startDate?: string;
      endDate?: string;
      isPermanent?: boolean;
      reason?: string;
    };

    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    if (!isPermanent && (!startDate || !endDate)) {
      res.status(400).json({ error: 'startDate and endDate are required for temporary blocks' });
      return;
    }

    try {
      const supabase = await getDbConnection();
      
      const blockData: any = {
        room_id: roomId,
        is_permanent: isPermanent || false,
        reason: reason || null,
        created_by_user_id: req.user.userId
      };

      if (isPermanent) {
        // For permanent blocks we can set a very wide date range to keep constraints simple
        blockData.start_date = '2000-01-01';
        blockData.end_date = '2100-01-01';
      } else {
        blockData.start_date = startDate;
        blockData.end_date = endDate;
      }

      const { data: blockRecord, error: insertError } = await supabase
        .from('room_blocks')
        .insert(blockData)
        .select()
        .single();

      if (insertError || !blockRecord) {
        throw insertError || new Error('Failed to block room');
      }

      await logAudit(
        req.user.userId,
        isPermanent ? 'Permanently blocked room' : 'Temporarily blocked room',
        'Room',
        roomId,
        JSON.stringify({ startDate, endDate, reason })
      );

      // Transform to match expected format
      const transformed = {
        Id: blockRecord.id,
        RoomId: blockRecord.room_id,
        StartDate: blockRecord.start_date,
        EndDate: blockRecord.end_date,
        IsPermanent: blockRecord.is_permanent,
        Reason: blockRecord.reason,
        CreatedByUserId: blockRecord.created_by_user_id,
        CreatedAt: blockRecord.created_at
      };

      res.status(201).json(transformed);
    } catch (error: any) {
      console.error('Block room error:', error);
      res.status(500).json({ error: 'Failed to block room', details: error.message });
    }
  }
);

// Simple calendar view data
app.get(
  '/api/admin/calendar',
  authMiddleware,
  requireRole(['Support', 'Manager', 'SuperAdmin']),
  async (req: AuthRequest, res) => {
    try {
      const supabase = await getDbConnection();

      const { data: reservations, error: resError } = await supabase
        .from('reservations')
        .select('id, room_id, start_date, end_date, status');

      const { data: blocks, error: blocksError } = await supabase
        .from('room_blocks')
        .select('id, room_id, start_date, end_date, is_permanent, reason');

      if (resError || blocksError) {
        throw resError || blocksError;
      }

      // Transform to match expected format
      const transformedReservations = reservations?.map((r: any) => ({
        Id: r.id,
        RoomId: r.room_id,
        StartDate: r.start_date,
        EndDate: r.end_date,
        Status: r.status
      })) || [];

      const transformedBlocks = blocks?.map((b: any) => ({
        Id: b.id,
        RoomId: b.room_id,
        StartDate: b.start_date,
        EndDate: b.end_date,
        IsPermanent: b.is_permanent,
        Reason: b.reason
      })) || [];

      res.json({
        reservations: transformedReservations,
        blocks: transformedBlocks
      });
    } catch (error: any) {
      console.error('Calendar data error:', error);
      res.status(500).json({ error: 'Failed to load calendar data', details: error.message });
    }
  }
);

app.all('/api/*', (req, res) => {
  // If we reach here, the API route wasn't matched by any handler above
  // Check if this is a known route with wrong method (405) or unknown route (404)
  const knownRoutes = [
    '/api/auth/register',
    '/api/auth/login',
    '/api/health',
    '/api/test',
    '/api/user/profile',
    '/api/user/email',
    '/api/user/password',
    '/api/user/reservations',
    '/api/public/available-rooms',
    '/api/public/reservations',
    '/api/admin/dashboard',
    '/api/admin/reservations',
    '/api/admin/calendar',
    '/api/admin/rooms'
  ];
  
  // Check if path matches a known route pattern (without method)
  const pathMatchesKnownRoute = knownRoutes.some(route => {
    // Handle parameterized routes
    if (route.includes(':id')) {
      const basePath = route.split(':')[0];
      return req.path.startsWith(basePath);
    }
    return req.path === route || req.path.startsWith(route + '/');
  });
  
  if (pathMatchesKnownRoute) {
    // Route exists but method not allowed - return 405
    console.log('[API 405] Method not allowed:', req.method, req.path);
    res.status(405).json({ 
      error: 'Method Not Allowed',
      path: req.path, 
      method: req.method,
      message: `Method ${req.method} is not allowed for ${req.path}`
    });
  } else {
    // Route doesn't exist - return 404
    console.log('[API 404] Endpoint not found:', req.method, req.path);
    res.status(404).json({ 
      error: 'API endpoint not found', 
      path: req.path, 
      method: req.method,
      message: `No handler found for ${req.method} ${req.path}`
    });
  }
  // DO NOT call next() - this is the final handler for unmatched API routes
});

/**
 * Serve static files from /browser
 * Exclude /api routes from static file serving
 */
app.use((req, res, next) => {
  // Skip static file serving for API routes
  if (req.path.startsWith('/api/')) {
    return next();
  }
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  })(req, res, next);
});

/**
 * Handle all other requests by rendering the Angular application.
 * This should be last to catch all non-API routes.
 * All /api routes should have been handled by the API route handlers above.
 */
app.use((req, res, next) => {
  // CRITICAL: Skip Angular handler for ALL API routes
  // If an API route reaches here, it means no Express route matched it
  const isApiRoute = req.path.startsWith('/api/') || 
                     req.url?.startsWith('/api/') || 
                     req.originalUrl?.startsWith('/api/');
  
  if (isApiRoute) {
    // This should never happen - all API routes should be handled by Express above
    // Return 404 (not 405) since the route simply wasn't found
    console.error('[API ERROR] API route reached Angular handler - Express route did not match!', {
      method: req.method,
      path: req.path,
      url: req.url,
      originalUrl: req.originalUrl,
      registeredRoutes: [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'GET /api/health',
        'GET /api/test',
        'POST /api/test',
        'GET /api/user/profile',
        'PUT /api/user/profile',
        'PUT /api/user/email',
        'PUT /api/user/password',
        'GET /api/user/reservations',
        'PUT /api/user/reservations/:id/cancel',
        'GET /api/public/available-rooms',
        'POST /api/public/reservations',
        'GET /api/admin/dashboard',
        'GET /api/admin/reservations',
        'POST /api/admin/reservations/:id/status',
        'POST /api/admin/reservations/:id/notes',
        'PUT /api/admin/reservations/:id',
        'GET /api/admin/rooms',
        'POST /api/admin/rooms/:id/status',
        'POST /api/admin/rooms/:id/block',
        'GET /api/admin/calendar'
      ]
    });
    res.status(404).json({ 
      error: 'API endpoint not found',
      path: req.path,
      method: req.method,
      message: 'API route not properly handled - check route registration'
    });
    return;
  }
  
  // Only handle non-API routes with Angular SSR
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

// Log all registered routes for debugging
console.log('[SERVER INIT] Express app initialized with routes');
console.log('[SERVER INIT] Registered API routes:', [
  'POST /api/auth/register',
  'POST /api/auth/login',
  'GET /api/health',
  'GET /api/test',
  'POST /api/test',
  'GET /api/user/profile',
  'PUT /api/user/profile',
  'PUT /api/user/email',
  'PUT /api/user/password',
  'GET /api/user/reservations',
  'PUT /api/user/reservations/:id/cancel',
  'GET /api/public/available-rooms',
  'POST /api/public/reservations',
  'GET /api/admin/dashboard',
  'GET /api/admin/reservations',
  'POST /api/admin/reservations/:id/status',
  'POST /api/admin/reservations/:id/notes',
  'PUT /api/admin/reservations/:id',
  'GET /api/admin/rooms',
  'POST /api/admin/rooms/:id/status',
  'POST /api/admin/rooms/:id/block',
  'GET /api/admin/calendar'
]);

const angularHandler = createNodeRequestHandler(app);

export const reqHandler = (req: any, res: any, next?: any) => {

  const isApiRoute = req.url?.startsWith('/api/') || 
                     req.path?.startsWith('/api/') || 
                     req.originalUrl?.startsWith('/api/');
  
  if (isApiRoute) {

    console.log('[Vercel Handler] Routing API request to Express:', req.method, req.url);

    app(req, res, next);
    return;
  }
  

  return angularHandler(req, res, next);
};
