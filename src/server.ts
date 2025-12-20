import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { getDbConnection } from './server/db.config.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// CORS middleware for API routes
app.use((req, res, next) => {
  // Only apply CORS to API routes
  if (req.path.startsWith('/api/')) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
  }
  next();
});

// Middleware for parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

    const pool = await getDbConnection();

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
    res.status(500).json({ error: 'Internal server error', details: error.message });
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

    const pool = await getDbConnection();

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
    const tokenPayload = {
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
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 * This should be last to catch all non-API routes.
 */
app.use('/**', (req, res, next) => {
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
    console.log(`Node Express server listening on https://jlsmvmycvnkfjqlicdrl.supabase.co${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
