import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import sql from 'mssql';
import { getDbConnection } from './db.config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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
const JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key-change-in-production';

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

const authMiddleware: express.RequestHandler = (
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
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as AuthRequest).user = decoded;
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
    const pool = await getDbConnection();
    await pool
      .request()
      .input('userId', sql.Int, userId)
      .input('action', sql.NVarChar, action)
      .input('entityType', sql.NVarChar, entityType)
      .input('entityId', sql.Int, entityId)
      .input('details', sql.NVarChar, details || null)
      .query(
        `INSERT INTO [dbo].[AuditLogs] (UserId, Action, EntityType, EntityId, Details)
         VALUES (@userId, @action, @entityType, @entityId, @details)`
      );
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

    let pool;
    try {
      pool = await getDbConnection();
    } catch (dbError: any) {
      console.error('Database connection failed:', dbError);
      return res.status(500).json({ 
        error: 'Database connection failed. Please check your database configuration and ensure SQL Server is running.',
        details: process.env['NODE_ENV'] === 'development' ? dbError.message : undefined
      });
    }

    // Check if user already exists
    const checkUserQuery = `SELECT Id FROM [dbo].[Users] WHERE Email = @email`;
    const checkResult = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(checkUserQuery);

    if (checkResult.recordset.length > 0) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert new user
    const insertQuery = `
      INSERT INTO [dbo].[Users] (Email, PasswordHash, FirstName, LastName, Phone)
      OUTPUT INSERTED.Id, INSERTED.Email, INSERTED.FirstName, INSERTED.LastName, INSERTED.Phone, INSERTED.CreatedAt
      VALUES (@email, @passwordHash, @firstName, @lastName, @phone)
    `;

    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .input('passwordHash', sql.NVarChar, passwordHash)
      .input('firstName', sql.NVarChar, firstName || null)
      .input('lastName', sql.NVarChar, lastName || null)
      .input('phone', sql.NVarChar, phone || null)
      .query(insertQuery);

    const user = result.recordset[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.Id, email: user.Email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.Id,
        email: user.Email,
        firstName: user.FirstName,
        lastName: user.LastName,
        phone: user.Phone
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
    if (error.code === 'ELOGIN' || error.message?.includes('Login failed')) {
      errorMessage = 'Database authentication failed. Please check your database credentials.';
    } else if (error.code === 'ETIMEOUT' || error.message?.includes('timeout')) {
      errorMessage = 'Database connection timeout. Please check if SQL Server is running.';
    } else if (error.message?.includes('Cannot open database')) {
      errorMessage = 'Database does not exist. Please create the database first.';
    } else if (error.message?.includes('ENOTFOUND') || error.message?.includes('getaddrinfo')) {
      errorMessage = 'Cannot connect to database server. Please check the server name and ensure SQL Server is running.';
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

    let pool;
    try {
      pool = await getDbConnection();
    } catch (dbError: any) {
      console.error('Database connection failed:', dbError);
      return res.status(500).json({ 
        error: 'Database connection failed. Please check your database configuration and ensure SQL Server is running.',
        details: process.env['NODE_ENV'] === 'development' ? dbError.message : undefined
      });
    }

    // Find user by email
    const findUserQuery = `
      SELECT Id, Email, PasswordHash, FirstName, LastName, Phone, Role, CreatedAt
      FROM [dbo].[Users]
      WHERE Email = @email
    `;

    const result = await pool.request()
      .input('email', sql.NVarChar, email)
      .query(findUserQuery);

    if (result.recordset.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.recordset[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.PasswordHash);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const tokenPayload: JwtPayload = {
      userId: user.Id,
      email: user.Email,
      role: user.Role || 'User'
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      user: {
        id: user.Id,
        email: user.Email,
        firstName: user.FirstName,
        lastName: user.LastName,
        phone: user.Phone,
        role: user.Role
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

    const pool = await getDbConnection();
    const result = await pool
      .request()
      .input('id', sql.Int, req.user.userId)
      .query(`
        SELECT Id, Email, FirstName, LastName, Phone, Role
        FROM [dbo].[Users]
        WHERE Id = @id
      `);

    if (!result.recordset.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.recordset[0];
    res.json({
      id: user.Id,
      email: user.Email,
      firstName: user.FirstName,
      lastName: user.LastName,
      phone: user.Phone,
      role: user.Role
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

    const pool = await getDbConnection();
    const result = await pool
      .request()
      .input('id', sql.Int, req.user.userId)
      .input('firstName', sql.NVarChar, firstName || null)
      .input('lastName', sql.NVarChar, lastName || null)
      .input('phone', sql.NVarChar, phone || null)
      .query(`
        UPDATE [dbo].[Users]
        SET FirstName = @firstName,
            LastName = @lastName,
            Phone = @phone,
            UpdatedAt = GETDATE()
        WHERE Id = @id;
        SELECT Id, Email, FirstName, LastName, Phone, Role FROM [dbo].[Users] WHERE Id = @id;
      `);

    const user = result.recordset[0];
    res.json({
      id: user.Id,
      email: user.Email,
      firstName: user.FirstName,
      lastName: user.LastName,
      phone: user.Phone,
      role: user.Role
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

    const pool = await getDbConnection();

    // Ensure email is not already taken
    const exists = await pool
      .request()
      .input('email', sql.NVarChar, email)
      .query(
        `SELECT Id FROM [dbo].[Users] WHERE Email = @email AND Id <> ${req.user.userId}`
      );
    if (exists.recordset.length) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const result = await pool
      .request()
      .input('id', sql.Int, req.user.userId)
      .input('email', sql.NVarChar, email)
      .query(`
        UPDATE [dbo].[Users]
        SET Email = @email, UpdatedAt = GETDATE()
        WHERE Id = @id;
        SELECT Id, Email, FirstName, LastName, Phone, Role FROM [dbo].[Users] WHERE Id = @id;
      `);

    const user = result.recordset[0];
    res.json({
      id: user.Id,
      email: user.Email,
      firstName: user.FirstName,
      lastName: user.LastName,
      phone: user.Phone,
      role: user.Role
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

    const pool = await getDbConnection();
    const userResult = await pool
      .request()
      .input('id', sql.Int, req.user.userId)
      .query(`
        SELECT Id, PasswordHash
        FROM [dbo].[Users]
        WHERE Id = @id
      `);

    if (!userResult.recordset.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const dbUser = userResult.recordset[0];
    const isValid = await bcrypt.compare(currentPassword, dbUser.PasswordHash);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool
      .request()
      .input('id', sql.Int, req.user.userId)
      .input('passwordHash', sql.NVarChar, newHash)
      .query(`
        UPDATE [dbo].[Users]
        SET PasswordHash = @passwordHash, UpdatedAt = GETDATE()
        WHERE Id = @id;
      `);

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
      const pool = await getDbConnection();

      const [pendingReservations, occupancy, blockedRooms] = await Promise.all([
        pool
          .request()
          .query(
            `SELECT COUNT(*) AS TotalPending FROM [dbo].[Reservations] WHERE [Status] = 'Pending'`
          ),
        pool
          .request()
          .query(
            `SELECT 
               CAST(
                 COUNT(CASE WHEN res.[Status] IN ('Approved', 'Completed') THEN 1 END) AS FLOAT
               ) / NULLIF(COUNT(r.Id), 0) AS OccupancyRate
             FROM [dbo].[Rooms] r
             LEFT JOIN [dbo].[Reservations] res ON res.RoomId = r.Id 
               AND res.[Status] IN ('Approved','Completed') 
               AND res.StartDate <= CAST(GETDATE() AS DATE)
               AND res.EndDate >= CAST(GETDATE() AS DATE)`
          ),
        pool
          .request()
          .query(
            `SELECT COUNT(DISTINCT RoomId) AS BlockedRoomsCount 
             FROM [dbo].[RoomBlocks] 
             WHERE IsPermanent = 1 
                OR (StartDate <= CAST(GETDATE() AS DATE) AND EndDate >= CAST(GETDATE() AS DATE))`
          )
      ]);

      res.json({
        totalPendingReservations: pendingReservations.recordset[0]?.TotalPending || 0,
        occupancyRate: occupancy.recordset[0]?.OccupancyRate || 0,
        blockedRoomsCount: blockedRooms.recordset[0]?.BlockedRoomsCount || 0
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
      const pool = await getDbConnection();
      const { status, userId, roomId } = req.query;

      let query = `
        SELECT r.Id, r.UserId, r.RoomId, r.StartDate, r.EndDate, r.Status, r.TotalPrice,
               r.GuestFirstName, r.GuestLastName, r.GuestEmail, r.GuestPhone,
               r.CreatedAt, r.CanceledAt, r.CanceledBy,
               COALESCE(u.Email, r.GuestEmail) AS Email,
               COALESCE(u.FirstName, r.GuestFirstName) AS FirstName,
               COALESCE(u.LastName, r.GuestLastName) AS LastName,
               rm.Name AS RoomName,
               CASE 
                 WHEN r.Status = 'Cancelled' AND r.CanceledBy = 'User' THEN 'Canceled by user'
                 WHEN r.Status = 'Cancelled' AND r.CanceledBy = 'Admin' THEN 'Canceled by admin'
                 ELSE r.Status
               END AS DisplayStatus
        FROM [dbo].[Reservations] r
        LEFT JOIN [dbo].[Users] u ON u.Id = r.UserId
        LEFT JOIN [dbo].[Rooms] rm ON rm.Id = r.RoomId
        WHERE 1 = 1
      `;

      const request = pool.request();

      if (status) {
        query += ' AND r.Status = @status';
        request.input('status', sql.NVarChar, status);
      }

      if (userId) {
        query += ' AND r.UserId = @userId';
        request.input('userId', sql.Int, Number(userId));
      }

      if (roomId) {
        query += ' AND r.RoomId = @roomId';
        request.input('roomId', sql.Int, Number(roomId));
      }

      query += ' ORDER BY r.CreatedAt DESC';

      const result = await request.query(query);
      res.json(result.recordset);
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
      const pool = await getDbConnection();
      
      // If canceling, set CanceledBy to 'Admin'
      let updateQuery = `UPDATE [dbo].[Reservations]
           SET Status = @status, UpdatedAt = GETDATE()`;
      
      if (status === 'Cancelled') {
        updateQuery += `, CanceledBy = 'Admin', CanceledAt = GETDATE()`;
      }
      
      updateQuery += ` WHERE Id = @id;
           SELECT * FROM [dbo].[Reservations] WHERE Id = @id;`;
      
      const result = await pool
        .request()
        .input('id', sql.Int, reservationId)
        .input('status', sql.NVarChar, status)
        .query(updateQuery);

      if (result.recordset.length === 0) {
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

      const updatedReservation = result.recordset[0];
      
      // Get user email for notification
      const userResult = await pool
        .request()
        .input('reservationId', sql.Int, reservationId)
        .query(`
          SELECT COALESCE(u.Email, r.GuestEmail) AS Email,
                 COALESCE(u.FirstName, r.GuestFirstName) AS FirstName,
                 COALESCE(u.LastName, r.GuestLastName) AS LastName,
                 r.RoomId,
                 rm.Name AS RoomName,
                 r.StartDate,
                 r.EndDate
          FROM [dbo].[Reservations] r
          LEFT JOIN [dbo].[Users] u ON u.Id = r.UserId
          LEFT JOIN [dbo].[Rooms] rm ON rm.Id = r.RoomId
          WHERE r.Id = @reservationId
        `);

      // Send email notification if status changed to Approved, Rejected, or Cancelled
      if (userResult.recordset.length > 0 && mailTransporter) {
        const userData = userResult.recordset[0];
        const userEmail = userData.Email;
        const userName = `${userData.FirstName || ''} ${userData.LastName || ''}`.trim() || 'Guest';
        const roomName = userData.RoomName || 'Room';
        const checkIn = new Date(userData.StartDate).toLocaleDateString();
        const checkOut = new Date(userData.EndDate).toLocaleDateString();

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

      res.json(updatedReservation);
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
      const pool = await getDbConnection();
      const result = await pool
        .request()
        .input('reservationId', sql.Int, reservationId)
        .input('note', sql.NVarChar, note)
        .input('createdByUserId', sql.Int, req.user.userId)
        .query(
          `INSERT INTO [dbo].[ReservationNotes] (ReservationId, Note, CreatedByUserId)
           OUTPUT INSERTED.*
           VALUES (@reservationId, @note, @createdByUserId)`
        );

      await logAudit(
        req.user.userId,
        'Added internal note',
        'Reservation',
        reservationId,
        note
      );

      res.status(201).json(result.recordset[0]);
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
      const pool = await getDbConnection();
      const fields: string[] = [];
      const request = pool.request().input('id', sql.Int, reservationId);

      if (startDate) {
        fields.push('StartDate = @startDate');
        request.input('startDate', sql.Date, startDate);
      }
      if (endDate) {
        fields.push('EndDate = @endDate');
        request.input('endDate', sql.Date, endDate);
      }
      if (roomId) {
        fields.push('RoomId = @roomId');
        request.input('roomId', sql.Int, roomId);
      }

      const query = `
        UPDATE [dbo].[Reservations]
        SET ${fields.join(', ')}, UpdatedAt = GETDATE()
        WHERE Id = @id;
        SELECT * FROM [dbo].[Reservations] WHERE Id = @id;
      `;

      const result = await request.query(query);
      if (result.recordset.length === 0) {
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

      res.json(result.recordset[0]);
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
      const pool = await getDbConnection();
      const result = await pool.request().query(`
        SELECT r.*, 
               CASE 
                 WHEN EXISTS (
                   SELECT 1 FROM [dbo].[RoomBlocks] b
                   WHERE b.RoomId = r.Id
                     AND (b.IsPermanent = 1 OR (b.StartDate <= CAST(GETDATE() AS DATE) AND b.EndDate >= CAST(GETDATE() AS DATE)))
               ) THEN 1 ELSE 0 END AS IsCurrentlyBlocked
        FROM [dbo].[Rooms] r
        ORDER BY r.Name
      `);
      res.json(result.recordset);
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
      const pool = await getDbConnection();
      const result = await pool
        .request()
        .input('id', sql.Int, roomId)
        .input('status', sql.NVarChar, status)
        .query(
          `UPDATE [dbo].[Rooms]
           SET Status = @status, UpdatedAt = GETDATE()
           WHERE Id = @id;
           SELECT * FROM [dbo].[Rooms] WHERE Id = @id;`
        );

      if (result.recordset.length === 0) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (req.user) {
        await logAudit(req.user.userId, `Changed room status to ${status}`, 'Room', roomId);
      }

      const updatedRoom = result.recordset[0];
      
      // Emit real-time update to all connected clients
      io.emit('room-status-updated', {
        roomId,
        status,
        room: updatedRoom
      });

      res.json(updatedRoom);
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
      const pool = await getDbConnection();
      const request = pool
        .request()
        .input('roomId', sql.Int, roomId)
        .input('isPermanent', sql.Bit, isPermanent ? 1 : 0)
        .input('reason', sql.NVarChar, reason || null)
        .input('createdByUserId', sql.Int, req.user.userId);

      if (isPermanent) {
        // For permanent blocks we can set a very wide date range to keep constraints simple
        request.input('startDate', sql.Date, new Date(2000, 0, 1));
        request.input('endDate', sql.Date, new Date(2100, 0, 1));
      } else {
        request.input('startDate', sql.Date, startDate as string);
        request.input('endDate', sql.Date, endDate as string);
      }

      const result = await request.query(
        `INSERT INTO [dbo].[RoomBlocks] (RoomId, StartDate, EndDate, IsPermanent, Reason, CreatedByUserId)
         OUTPUT INSERTED.*
         VALUES (@roomId, @startDate, @endDate, @isPermanent, @reason, @createdByUserId);`
      );

      await logAudit(
        req.user.userId,
        isPermanent ? 'Permanently blocked room' : 'Temporarily blocked room',
        'Room',
        roomId,
        JSON.stringify({ startDate, endDate, reason })
      );

      res.status(201).json(result.recordset[0]);
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
      const pool = await getDbConnection();

      const reservations = await pool.request().query(`
        SELECT Id, RoomId, StartDate, EndDate, Status
        FROM [dbo].[Reservations]
      `);

      const blocks = await pool.request().query(`
        SELECT Id, RoomId, StartDate, EndDate, IsPermanent, Reason
        FROM [dbo].[RoomBlocks]
      `);

      res.json({
        reservations: reservations.recordset,
        blocks: blocks.recordset
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

    const pool = await getDbConnection();
    const request = pool
      .request()
      .input('userId', sql.Int, userId ?? null)
      .input('roomId', sql.Int, roomId ?? null)
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate)
      .input('status', sql.NVarChar, 'Pending')
      .input('totalPrice', sql.Decimal(18, 2), totalPrice)
      .input('guestFirstName', sql.NVarChar, firstName)
      .input('guestLastName', sql.NVarChar, lastName)
      .input('guestEmail', sql.NVarChar, email)
      .input('guestPhone', sql.NVarChar, phone || null)
      .input('notes', sql.NVarChar, notes || null);

    const insertQuery = `
      INSERT INTO [dbo].[Reservations] (
        UserId,
        RoomId,
        StartDate,
        EndDate,
        Status,
        TotalPrice,
        GuestFirstName,
        GuestLastName,
        GuestEmail,
        GuestPhone,
        Notes
      )
      OUTPUT INSERTED.*
      VALUES (
        @userId,
        @roomId,
        @startDate,
        @endDate,
        @status,
        @totalPrice,
        @guestFirstName,
        @guestLastName,
        @guestEmail,
        @guestPhone,
        @notes
      );
    `;

    const result = await request.query(insertQuery);
    const reservation = result.recordset[0];

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

    const pool = await getDbConnection();
    const result = await pool
      .request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT r.Id,
               r.RoomId,
               r.StartDate,
               r.EndDate,
               r.Status,
               r.TotalPrice,
               r.GuestFirstName,
               r.GuestLastName,
               r.GuestEmail,
               r.GuestPhone,
               r.Notes,
               r.CreatedAt,
               r.CanceledAt,
               r.CanceledBy,
               rm.Name AS RoomName,
               rm.Type AS RoomType,
               rm.BasePrice
        FROM [dbo].[Reservations] r
        LEFT JOIN [dbo].[Rooms] rm ON rm.Id = r.RoomId
        WHERE r.UserId = @userId
        ORDER BY r.StartDate DESC, r.CreatedAt DESC
      `);

    res.json(result.recordset);
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
    const pool = await getDbConnection();
    
    // First verify the reservation belongs to this user
    const checkResult = await pool
      .request()
      .input('id', sql.Int, reservationId)
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT Id, Status FROM [dbo].[Reservations]
        WHERE Id = @id AND UserId = @userId
      `);

    if (checkResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Reservation not found or you do not have permission to cancel it' });
    }

    const reservation = checkResult.recordset[0];
    
    // Don't allow canceling already canceled or completed reservations
    if (reservation.Status === 'Cancelled' || reservation.Status === 'Completed') {
      return res.status(400).json({ error: `Cannot cancel a reservation with status: ${reservation.Status}` });
    }

    // Don't allow users to cancel approved reservations
    if (reservation.Status === 'Approved') {
      return res.status(400).json({ error: 'Cannot cancel an approved reservation. Please contact support.' });
    }

    // Update status to Cancelled and set CanceledAt timestamp and CanceledBy
    const updateResult = await pool
      .request()
      .input('id', sql.Int, reservationId)
      .query(`
        UPDATE [dbo].[Reservations]
        SET Status = 'Cancelled',
            CanceledAt = GETDATE(),
            CanceledBy = 'User',
            UpdatedAt = GETDATE()
        WHERE Id = @id;
        SELECT * FROM [dbo].[Reservations] WHERE Id = @id;
      `);

    const cancelledReservation = updateResult.recordset[0];
    
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

    const pool = await getDbConnection();
    const result = await pool
      .request()
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate)
      .query(`
        SELECT r.*
        FROM [dbo].[Rooms] r
        WHERE r.VisibleToUsers = 1
          AND r.Status = 'Available'
          AND NOT EXISTS (
            SELECT 1
            FROM [dbo].[Reservations] res
            WHERE res.RoomId = r.Id
              AND res.Status IN ('Approved','Completed')
              AND res.Status != 'Cancelled'
              AND res.StartDate < @endDate
              AND res.EndDate > @startDate
          )
          AND NOT EXISTS (
            SELECT 1
            FROM [dbo].[RoomBlocks] b
            WHERE b.RoomId = r.Id
              AND (
                b.IsPermanent = 1
                OR (b.StartDate < @endDate AND b.EndDate > @startDate)
              )
          )
        ORDER BY r.Name;
      `);

    res.json(result.recordset);
  } catch (error: any) {
    console.error('Available rooms error:', error);
    res.status(500).json({ error: 'Failed to load available rooms', details: error.message });
  }
});

/**
 * Supabase Storage API Endpoints
 * These endpoints handle file storage operations using Supabase Storage
 * while keeping MSSQL for all database operations
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

      // Optionally update room record in MSSQL with image URL
      // This keeps the database reference while storing the file in Supabase
      try {
        const pool = await getDbConnection();
        // You can add an ImageUrl column to Rooms table if needed
        // await pool.request()
        //   .input('id', sql.Int, roomId)
        //   .input('imageUrl', sql.NVarChar, result.url)
        //   .query('UPDATE [dbo].[Rooms] SET ImageUrl = @imageUrl WHERE Id = @id');
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

httpServer.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
  console.log('✓ MSSQL database connection ready');
  console.log('✓ Supabase storage configured (storage only)');
  console.log('✓ WebSocket server ready');
});

