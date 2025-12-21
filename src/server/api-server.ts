import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getDbConnection, initializeDatabase } from './db.config';
import bcrypt from 'bcryptjs';
import * as jose from 'jose';
import nodemailer from 'nodemailer';
import multer from 'multer';
import {
  getSupabaseClient,
  initializeStorageBuckets,
  uploadFile,
  deleteFile,
  getPublicUrl,
  listFiles,
  STORAGE_BUCKETS
} from './supabase-storage.config';

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware for parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Multer configuration for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// CORS middleware for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// JWT secret key (in production, use environment variable)
const JWT_SECRET = process.env['JWT_SECRET'] || 'npUtks96Wbo1f8mJYd2z1A/79vQPQIaDzbBcQe3GEnsAgFB3xP4rMebrMRYCVw3BiHZfe2LzEFY5F0IXgCZOhA==';

// Email configuration (set these in your environment)
const SMTP_HOST = process.env['SMTP_HOST'] || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env['SMTP_PORT'] || 587);
const SMTP_USER = process.env['SMTP_USER'] || process.env['HOTEL_EMAIL'] || '';
const SMTP_PASS = process.env['SMTP_PASS'] || '';
const HOTEL_EMAIL = process.env['HOTEL_EMAIL'] || SMTP_USER || 'simeonskiqq@gmail.com';

const mailTransporter =
  SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      })
    : null;

async function sendReservationEmails(options: {
  guestEmail: string;
  guestName: string;
  guestPhone?: string | null;
  roomName: string;
  roomPrice?: number | null;
  checkIn: string;
  checkOut: string;
}) {
  if (!mailTransporter) {
    throw new Error('Email not configured: set SMTP_USER and SMTP_PASS (and SMTP_HOST/SMTP_PORT if not using Gmail).');
  }

  const {
    guestEmail,
    guestName,
    guestPhone,
    roomName,
    roomPrice,
    checkIn,
    checkOut
  } = options;

  const subject = `Reservation request for ${roomName} (${checkIn} - ${checkOut})`;
  const textBody = `
Reservation request

Guest: ${guestName}
Email: ${guestEmail}
Phone: ${guestPhone || 'Not provided'}

Room: ${roomName}
Price per night: ${roomPrice ?? 'N/A'}
Check-in: ${checkIn}
Check-out: ${checkOut}
`.trim();

  // Email to guest
  await mailTransporter.sendMail({
    from: `"Aurora Hotel" <${HOTEL_EMAIL}>`,
    to: guestEmail,
    subject: `Your reservation request for ${roomName}`,
    text:
      `Dear ${guestName},\n\n` +
      `We have received your reservation request for ${roomName} from ${checkIn} to ${checkOut}.\n` +
      `We will contact you shortly to confirm availability.\n\n` +
      `Best regards,\nAurora Hotel`,
    html:
      `<p>Dear ${guestName},</p>` +
      `<p>We have received your reservation request for <strong>${roomName}</strong> from <strong>${checkIn}</strong> to <strong>${checkOut}</strong>.</p>` +
      `<p>We will contact you shortly to confirm availability.</p>` +
      `<p>Best regards,<br/>Aurora Hotel</p>`
  });

  // Email to hotel
  await mailTransporter.sendMail({
    from: `"Aurora Hotel Website" <${HOTEL_EMAIL}>`,
    to: HOTEL_EMAIL,
    subject,
    text: textBody
  });
}

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
    // jose.jwtVerify is async and works with Edge runtime
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret);
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
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    let supabase;
    try {
      supabase = await getDbConnection();
    } catch (dbError: any) {
      console.error('Database connection failed:', dbError);
      return res.status(500).json({ 
        error: 'Database connection failed. Please check your Supabase configuration.',
        details: process.env['NODE_ENV'] === 'development' ? dbError.message : undefined
      });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({ error: 'User with this email already exists' });
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
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new jose.SignJWT({ userId: user.id, email: user.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

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
    return;
  } catch (error: any) {
    console.error('Registration error:', error);
    console.error('Error stack:', error.stack);
    
    // Provide more helpful error messages
    let errorMessage = 'Internal server error';
    if (error.message) {
      errorMessage = error.message;
    }
    
    // Check for specific database errors
    if (error.code === 'PGRST301' || error.message?.includes('duplicate key')) {
      errorMessage = 'User with this email already exists.';
    } else if (error.code === 'PGRST116') {
      errorMessage = 'Database table does not exist. Please run migrations.';
    } else if (error.message?.includes('connection') || error.message?.includes('timeout')) {
      errorMessage = 'Database connection failed. Please check your Supabase configuration.';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env['NODE_ENV'] === 'development' ? error.message : undefined
    });
    return;
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    let supabase;
    try {
      supabase = await getDbConnection();
    } catch (dbError: any) {
      console.error('Database connection failed:', dbError);
      return res.status(500).json({ 
        error: 'Database connection failed. Please check your Supabase configuration.',
        details: process.env['NODE_ENV'] === 'development' ? dbError.message : undefined
      });
    }

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, password_hash, first_name, last_name, phone, role, created_at')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const tokenPayload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role || 'User'
    };

    // Generate JWT token using jose (Edge runtime compatible)
    const secret = new TextEncoder().encode(JWT_SECRET);
    const token = await new jose.SignJWT(tokenPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret);

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
    return;
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
    return;
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API server is running' });
});

/**
 * User profile endpoints
 */
app.get('/api/user/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const supabase = await getDbConnection();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, phone, role')
      .eq('id', req.user.userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
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

app.put('/api/user/profile', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
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

app.put('/api/user/email', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { email } = req.body as { email?: string };
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
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
      return res.status(409).json({ error: 'Email already in use' });
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

app.put('/api/user/password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ error: 'New password must be at least 6 characters long' });
    }

    const supabase = await getDbConnection();
    const { data: dbUser, error: userError } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', req.user.userId)
      .single();

    if (userError || !dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(currentPassword, dbUser.password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
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
          canceled_by,
          users:user_id (
            email,
            first_name,
            last_name
          ),
          rooms:room_id (
            name
          )
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

      // Transform data to match expected format
      const transformed = reservations?.map((r: any) => ({
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
        Email: r.users?.email || r.guest_email,
        FirstName: r.users?.first_name || r.guest_first_name,
        LastName: r.users?.last_name || r.guest_last_name,
        RoomName: r.rooms?.name,
        DisplayStatus: r.status === 'Cancelled' && r.canceled_by === 'User' 
          ? 'Canceled by user'
          : r.status === 'Cancelled' && r.canceled_by === 'Admin'
          ? 'Canceled by admin'
          : r.status
      })) || [];

      res.json(transformed);
    } catch (error: any) {
      console.error('List reservations error:', error);
      res
        .status(500)
        .json({ error: 'Failed to load reservations', details: error.message });
    }
  }
);

// Change reservation status (approve / reject / cancel / complete)
app.post(
  '/api/admin/reservations/:id/status',
  authMiddleware,
  requireRole(['Support', 'Manager', 'SuperAdmin']),
  async (req: AuthRequest, res) => {
    const reservationId = Number(req.params['id']);
    const { status } = req.body as { status?: string };

    if (
      !status ||
      !['Pending', 'Approved', 'Rejected', 'Cancelled', 'Completed'].includes(status)
    ) {
      return res.status(400).json({ error: 'Invalid status' });
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
        return res.status(404).json({ error: 'Reservation not found' });
      }

      if (req.user) {
        await logAudit(
          req.user.userId,
          `Changed reservation status to ${status}`,
          'Reservation',
          reservationId
        );
      }
      
      // Get user email for notification
      const { data: reservationData, error: fetchError } = await supabase
        .from('reservations')
        .select(`
          user_id,
          room_id,
          start_date,
          end_date,
          guest_email,
          guest_first_name,
          guest_last_name,
          users:user_id (
            email,
            first_name,
            last_name
          ),
          rooms:room_id (
            name
          )
        `)
        .eq('id', reservationId)
        .single();

      // Send email notification if status changed to Approved, Rejected, or Cancelled
      if (reservationData && mailTransporter) {
        const userEmail = reservationData.users?.email || reservationData.guest_email;
        const userName = reservationData.users 
          ? `${reservationData.users.first_name || ''} ${reservationData.users.last_name || ''}`.trim()
          : `${reservationData.guest_first_name || ''} ${reservationData.guest_last_name || ''}`.trim() || 'Guest';
        const roomName = reservationData.rooms?.name || 'Room';
        const checkIn = new Date(reservationData.start_date).toLocaleDateString();
        const checkOut = new Date(reservationData.end_date).toLocaleDateString();

        if (userEmail && ['Approved', 'Rejected', 'Cancelled'].includes(status)) {
          try {
            let subject = '';
            let textBody = '';
            let htmlBody = '';

            if (status === 'Approved') {
              subject = `Reservation Approved - ${roomName}`;
              textBody = `Dear ${userName},\n\nYour reservation for ${roomName} from ${checkIn} to ${checkOut} has been approved.\n\nWe look forward to welcoming you!\n\nBest regards,\nAurora Hotel`;
              htmlBody = `<p>Dear ${userName},</p><p>Your reservation for <strong>${roomName}</strong> from <strong>${checkIn}</strong> to <strong>${checkOut}</strong> has been <strong>approved</strong>.</p><p>We look forward to welcoming you!</p><p>Best regards,<br/>Aurora Hotel</p>`;
            } else if (status === 'Rejected') {
              subject = `Reservation Update - ${roomName}`;
              textBody = `Dear ${userName},\n\nUnfortunately, your reservation request for ${roomName} from ${checkIn} to ${checkOut} has been rejected.\n\nPlease contact us if you have any questions or would like to make a new reservation.\n\nBest regards,\nAurora Hotel`;
              htmlBody = `<p>Dear ${userName},</p><p>Unfortunately, your reservation request for <strong>${roomName}</strong> from <strong>${checkIn}</strong> to <strong>${checkOut}</strong> has been <strong>rejected</strong>.</p><p>Please contact us if you have any questions or would like to make a new reservation.</p><p>Best regards,<br/>Aurora Hotel</p>`;
            } else if (status === 'Cancelled') {
              subject = `Reservation Cancelled - ${roomName}`;
              textBody = `Dear ${userName},\n\nYour reservation for ${roomName} from ${checkIn} to ${checkOut} has been cancelled by the administration.\n\nIf you have any questions, please contact us.\n\nBest regards,\nAurora Hotel`;
              htmlBody = `<p>Dear ${userName},</p><p>Your reservation for <strong>${roomName}</strong> from <strong>${checkIn}</strong> to <strong>${checkOut}</strong> has been <strong>cancelled</strong> by the administration.</p><p>If you have any questions, please contact us.</p><p>Best regards,<br/>Aurora Hotel</p>`;
            }

            await mailTransporter.sendMail({
              from: `"Aurora Hotel" <${HOTEL_EMAIL}>`,
              to: userEmail,
              subject: subject,
              text: textBody,
              html: htmlBody
            });
          } catch (emailError) {
            console.error('Failed to send status update email:', emailError);
            // Don't fail the request if email fails
          }
        }
      }
      
      // Emit real-time update to all connected clients
      io.emit('reservation-status-updated', {
        reservationId,
        status,
        reservation: updatedReservation
      });

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
  async (req: AuthRequest, res) => {
    const reservationId = Number(req.params['id']);
    const { note } = req.body as { note?: string };

    if (!note || !note.trim()) {
      return res.status(400).json({ error: 'Note is required' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
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
  async (req: AuthRequest, res) => {
    const reservationId = Number(req.params['id']);
    const { startDate, endDate, roomId } = req.body as {
      startDate?: string;
      endDate?: string;
      roomId?: number;
    };

    if (!startDate && !endDate && !roomId) {
      return res
        .status(400)
        .json({ error: 'Nothing to update. Provide startDate, endDate or roomId.' });
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
        return res.status(404).json({ error: 'Reservation not found' });
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
  async (req: AuthRequest, res) => {
    const roomId = Number(req.params['id']);
    const { status } = req.body as { status?: string };

    if (!status || !['Available', 'Reserved', 'Blocked', 'Maintenance'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
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
        return res.status(404).json({ error: 'Room not found' });
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
      
      // Emit real-time update to all connected clients
      io.emit('room-status-updated', {
        roomId,
        status,
        room: transformed
      });

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
  async (req: AuthRequest, res) => {
    const roomId = Number(req.params['id']);
    const { startDate, endDate, isPermanent, reason } = req.body as {
      startDate?: string;
      endDate?: string;
      isPermanent?: boolean;
      reason?: string;
    };

    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!isPermanent && (!startDate || !endDate)) {
      return res
        .status(400)
        .json({ error: 'startDate and endDate are required for temporary blocks' });
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

/**
 * Public reservation endpoint used by the booking page.
 * Stores reservation in the Reservations table so it is visible in the admin panel.
 */
app.post('/api/public/reservations', async (req, res) => {
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
      return res.status(400).json({ error: 'Missing required reservation data' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res
        .status(400)
        .json({ error: 'Invalid dates. End date must be after start date.' });
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

    // Try to send emails, but do not fail the reservation if email sending fails
    try {
      await sendReservationEmails({
        guestEmail: email,
        guestName: `${firstName} ${lastName}`,
        guestPhone: phone,
        roomName: roomName || 'Room',
        roomPrice: pricePerNight ?? null,
        checkIn: start.toLocaleDateString(),
        checkOut: end.toLocaleDateString()
      });
    } catch (mailError) {
      console.error('Failed to send reservation emails:', mailError);
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
 * Authenticated endpoint: get reservations for the logged-in user.
 */
app.get('/api/user/reservations', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
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
        canceled_by,
        rooms:room_id (
          name,
          type,
          base_price
        )
      `)
      .eq('user_id', req.user.userId)
      .order('start_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // Transform the data to match expected format
    const transformed = reservations?.map((r: any) => ({
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
      RoomName: r.rooms?.name,
      RoomType: r.rooms?.type,
      BasePrice: r.rooms?.base_price
    })) || [];

    res.json(transformed);
  } catch (error: any) {
    console.error('User reservations error:', error);
    res.status(500).json({ error: 'Failed to load reservations', details: error.message });
  }
});

/**
 * Authenticated endpoint: cancel a reservation (user can only cancel their own).
 */
app.put('/api/user/reservations/:id/cancel', authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
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
      return res.status(404).json({ error: 'Reservation not found or you do not have permission to cancel it' });
    }
    
    // Don't allow canceling already canceled or completed reservations
    if (reservation.status === 'Cancelled' || reservation.status === 'Completed') {
      return res.status(400).json({ error: `Cannot cancel a reservation with status: ${reservation.status}` });
    }

    // Don't allow users to cancel approved reservations
    if (reservation.status === 'Approved') {
      return res.status(400).json({ error: 'Cannot cancel an approved reservation. Please contact support.' });
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
    
    // Emit real-time update to all connected clients
    io.emit('reservation-status-updated', {
      reservationId,
      status: 'Cancelled',
      reservation: cancelledReservation
    });

    res.json(cancelledReservation);
  } catch (error: any) {
    console.error('Cancel reservation error:', error);
    res.status(500).json({ error: 'Failed to cancel reservation', details: error.message });
  }
});

/**
 * Public endpoint: get available rooms for a date range.
 * Excludes rooms with approved/completed reservations or active blocks overlapping the range.
 */
app.get('/api/public/available-rooms', async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res
        .status(400)
        .json({ error: 'Invalid dates. End date must be after start date.' });
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
 * Supabase Storage API Endpoints
 * These endpoints handle file storage operations using Supabase Storage
 */

// Upload file endpoint
app.post(
  '/api/storage/upload',
  authMiddleware,
  requireRole(['Manager', 'SuperAdmin', 'Support']),
  upload.single('file'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const { bucket, path } = req.body as { bucket?: string; path?: string };

      if (!bucket || !Object.values(STORAGE_BUCKETS).includes(bucket as any)) {
        return res.status(400).json({
          error: 'Invalid bucket. Valid buckets: ' + Object.values(STORAGE_BUCKETS).join(', ')
        });
      }

      const filePath = path || `${Date.now()}-${req.file.originalname}`;
      const fileBuffer = Buffer.from(req.file.buffer);

      const result = await uploadFile(
        bucket,
        filePath,
        fileBuffer,
        req.file.mimetype,
        { upsert: true }
      );

      res.status(201).json({
        message: 'File uploaded successfully',
        path: result.path,
        url: result.url
      });
    } catch (error: any) {
      console.error('File upload error:', error);
      res.status(500).json({ error: 'Failed to upload file', details: error.message });
    }
  }
);

// Delete file endpoint
app.delete('/api/storage/delete', authMiddleware, requireRole(['Manager', 'SuperAdmin']), async (req: AuthRequest, res) => {
  try {
    const { bucket, path } = req.body as { bucket?: string; path?: string };

    if (!bucket || !path) {
      return res.status(400).json({ error: 'Bucket and path are required' });
    }

    if (!Object.values(STORAGE_BUCKETS).includes(bucket as any)) {
      return res.status(400).json({ error: 'Invalid bucket' });
    }

    await deleteFile(bucket, path);

    res.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('File delete error:', error);
    res.status(500).json({ error: 'Failed to delete file', details: error.message });
  }
});

// List files endpoint
app.get('/api/storage/list', authMiddleware, requireRole(['Manager', 'SuperAdmin', 'Support']), async (req: AuthRequest, res) => {
  try {
    const { bucket, path, limit, offset } = req.query as {
      bucket?: string;
      path?: string;
      limit?: string;
      offset?: string;
    };

    if (!bucket) {
      return res.status(400).json({ error: 'Bucket is required' });
    }

    if (!Object.values(STORAGE_BUCKETS).includes(bucket as any)) {
      return res.status(400).json({ error: 'Invalid bucket' });
    }

    const files = await listFiles(bucket, path, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined
    });

    // Add public URLs to each file
    const filesWithUrls = files.map((file) => ({
      ...file,
      url: getPublicUrl(bucket, path ? `${path}/${file.name}` : file.name)
    }));

    res.json(filesWithUrls);
  } catch (error: any) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files', details: error.message });
  }
});

// Get file URL endpoint (public, no auth required for public buckets)
app.get('/api/storage/url', (req, res) => {
  try {
    const { bucket, path } = req.query as { bucket?: string; path?: string };

    if (!bucket || !path) {
      return res.status(400).json({ error: 'Bucket and path are required' });
    }

    if (!Object.values(STORAGE_BUCKETS).includes(bucket as any)) {
      return res.status(400).json({ error: 'Invalid bucket' });
    }

    const url = getPublicUrl(bucket, path);
    res.json({ url });
  } catch (error: any) {
    console.error('Get URL error:', error);
    res.status(500).json({ error: 'Failed to get file URL', details: error.message });
  }
});

// Upload room image endpoint (convenience endpoint)
app.post(
  '/api/storage/rooms/:roomId/image',
  authMiddleware,
  requireRole(['Manager', 'SuperAdmin']),
  upload.single('image'),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image provided' });
      }

      const roomId = Number(req.params['roomId']);
      const filePath = `room-${roomId}/${Date.now()}-${req.file.originalname}`;
      const fileBuffer = Buffer.from(req.file.buffer);

      const result = await uploadFile(
        STORAGE_BUCKETS.ROOM_IMAGES,
        filePath,
        fileBuffer,
        req.file.mimetype,
        { upsert: false }
      );

      // Optionally update room record in Supabase with image URL
      // This keeps the database reference while storing the file in Supabase
      try {
        const supabase = await getDbConnection();
        // You can add an image_url column to rooms table if needed
        // await supabase
        //   .from('rooms')
        //   .update({ image_url: result.url })
        //   .eq('id', roomId);
      } catch (dbError) {
        console.error('Failed to update room image URL in database:', dbError);
        // Continue even if DB update fails
      }

      res.status(201).json({
        message: 'Room image uploaded successfully',
        path: result.path,
        url: result.url
      });
    } catch (error: any) {
      console.error('Room image upload error:', error);
      res.status(500).json({ error: 'Failed to upload room image', details: error.message });
    }
  }
);

const port = process.env['API_PORT'] || process.env['PORT'] || 4001;

// Initialize Supabase storage buckets on server start
initializeStorageBuckets()
  .then(() => {
    console.log('✓ Supabase storage initialized');
  })
  .catch((error) => {
    console.error('⚠ Supabase storage initialization failed:', error.message);
    console.log('⚠ Continuing without storage functionality...');
  });

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initialize database on server start
initializeDatabase()
  .then(() => {
    console.log('✓ Supabase PostgreSQL database initialized');
  })
  .catch((error) => {
    console.error('⚠ Database initialization failed:', error.message);
    console.log('⚠ Continuing - ensure tables are created via migrations');
  });

httpServer.listen(port, () => {
  console.log(`API server listening on https://site-lake-alpha.vercel.app:${port}`);
  console.log('✓ Supabase PostgreSQL database ready');
  console.log('✓ Supabase storage configured');
  console.log('✓ WebSocket server ready');
});

