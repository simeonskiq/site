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

app.all('/api/*', (req, res) => {
  // If we reach here, the API route wasn't matched by any handler above
  console.log('[API 404] Unmatched API route:', req.method, req.path, req.url, req.originalUrl);
  res.status(404).json({ 
    error: 'API endpoint not found', 
    path: req.path, 
    method: req.method,
    message: `No ${req.method} handler found for ${req.path}`
  });
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
        'POST /api/test'
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
  'GET /api/user/reservations'
]);

export const reqHandler = createNodeRequestHandler(app);
