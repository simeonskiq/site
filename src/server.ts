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
import jwt from 'jsonwebtoken';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

// CORS middleware for API routes
app.use((req, res, next): void => {
  // Only apply CORS to API routes
  if (req.path.startsWith('/api/')) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
  }
  next();
});

// Middleware for parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug middleware for API routes (can be removed in production)
app.use('/api/*', (req, res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
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

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

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
app.post('/api/auth/login', async (req, res): Promise<void> => {
  console.log('[LOGIN] POST /api/auth/login received', { 
    method: req.method, 
    path: req.path, 
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

    // Generate JWT token
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role || 'User'
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

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
 * Catch-all for unmatched API routes - must come after all API route definitions
 * This ensures API routes that don't match return 404, not Angular router errors
 */
app.all('/api/*', (req, res) => {
  console.log('[API 404] Unmatched API route:', req.method, req.path);
  res.status(404).json({ 
    error: 'API endpoint not found', 
    path: req.path, 
    method: req.method,
    message: `No ${req.method} handler found for ${req.path}`
  });
});

/**
 * Handle all other requests by rendering the Angular application.
 * This should be last to catch all non-API routes.
 * All /api routes should have been handled by the API route handlers above.
 */
app.use((req, res, next) => {
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

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
