import sql from 'mssql';

// Updated configuration for cross-platform
export const dbConfig: sql.config = {
  server: 'localhost', // or your SQL Server host
  database: 'AuroraHotel',
  user: 'HotelAdmin', // Required for tedious driver
  password: '123', // Required for tedious driver
  port: 1433,
  options: {
    encrypt: true,               // for Azure SQL; set false if local
    trustServerCertificate: true, // for local/self-signed certs
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

let pool: sql.ConnectionPool | null = null;

export async function getDbConnection(): Promise<sql.ConnectionPool> {
  if (!pool) {
    try {
      console.log('Attempting to connect to database...');
      console.log('Server:', dbConfig.server);
      console.log('Database:', dbConfig.database);

      pool = await sql.connect(dbConfig);
      console.log('✓ Connected to MSSQL database');

      await createUsersTable(pool);
    } catch (error: any) {
      console.error('✗ Database connection failed:', error);
      throw error;
    }
  }
  return pool;
}

async function createUsersTable(pool: sql.ConnectionPool): Promise<void> {
  try {
    const query = `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[Users] (
          [Id] INT IDENTITY(1,1) PRIMARY KEY,
          [Email] NVARCHAR(255) NOT NULL UNIQUE,
          [PasswordHash] NVARCHAR(255) NOT NULL,
          [FirstName] NVARCHAR(100),
          [LastName] NVARCHAR(100),
          [Phone] NVARCHAR(20),
          [CreatedAt] DATETIME2 DEFAULT GETDATE(),
          [UpdatedAt] DATETIME2 DEFAULT GETDATE()
        );
        CREATE INDEX IX_Users_Email ON [dbo].[Users]([Email]);
      END
    `;
    await pool.request().query(query);
    console.log('Users table ready');
  } catch (error) {
    console.error('Error creating users table:', error);
    throw error;
  }
}

export async function closeDbConnection(): Promise<void> {
  if (pool) {
    await pool.close();
    pool = null;
    console.log('Database connection closed');
  }
}
