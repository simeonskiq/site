import express from 'express';
import sql from 'mssql';
import { getDbConnection } from './db.config';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();

// Middleware for parsing JSON
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      SELECT Id, Email, PasswordHash, FirstName, LastName, Phone, CreatedAt
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
    const token = jwt.sign(
      { userId: user.Id, email: user.Email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
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
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
    return;
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API server is running' });
});


const port = process.env['API_PORT'] || process.env['PORT'] || 4001;
const server = app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});

