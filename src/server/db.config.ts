import sql from 'mssql';

// Updated configuration for cross-platform
export const dbConfig: sql.config = {
  server: 'DESKTOP-FEFVBSR/SQLEXPRESS', // or your SQL Server host
  database: 'AuroraHotel',
  user: 'HotelAdmin', // Required for tedious driver
  password: '123', // Required for tedious driver
  port: 1433,
  options: {
    encrypt: false, // for Azure SQL; set false if local
    trustServerCertificate: true, // for local/self-signed certs
    enableArithAbort: true
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
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

      // Ensure core tables exist
      await createUsersTable(pool);
      await createRoomsTable(pool);
      await createReservationsTable(pool);
      await createRoomBlocksTable(pool);
      await createReservationNotesTable(pool);
      await createAuditLogTable(pool);
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
          [Role] NVARCHAR(50) NOT NULL DEFAULT 'User', -- User, Support, Manager, SuperAdmin
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

async function createRoomsTable(pool: sql.ConnectionPool): Promise<void> {
  try {
    const query = `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Rooms]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[Rooms] (
          [Id] INT IDENTITY(1,1) PRIMARY KEY,
          [Name] NVARCHAR(255) NOT NULL,
          [Type] NVARCHAR(100),
          [BasePrice] DECIMAL(18,2) NOT NULL DEFAULT 0,
          [Status] NVARCHAR(50) NOT NULL DEFAULT 'Available', -- Available, Reserved, Blocked, Maintenance
          [VisibleToUsers] BIT NOT NULL DEFAULT 1,
          [VisibilityRole] NVARCHAR(50) NULL, -- null = public, or Admin, Staff, VIP
          [HasUnresolvedMaintenance] BIT NOT NULL DEFAULT 0,
          [CreatedAt] DATETIME2 DEFAULT GETDATE(),
          [UpdatedAt] DATETIME2 DEFAULT GETDATE()
        );
      END
    `;
    await pool.request().query(query);

    // Ensure new columns exist even if table was created earlier with an older schema
    await pool.request().query(`
      IF COL_LENGTH('dbo.Rooms', 'Type') IS NULL
        ALTER TABLE [dbo].[Rooms] ADD [Type] NVARCHAR(100) NULL;
      IF COL_LENGTH('dbo.Rooms', 'BasePrice') IS NULL
        ALTER TABLE [dbo].[Rooms] ADD [BasePrice] DECIMAL(18,2) NOT NULL DEFAULT 0;
      IF COL_LENGTH('dbo.Rooms', 'Status') IS NULL
        ALTER TABLE [dbo].[Rooms] ADD [Status] NVARCHAR(50) NOT NULL DEFAULT 'Available';
      IF COL_LENGTH('dbo.Rooms', 'VisibleToUsers') IS NULL
        ALTER TABLE [dbo].[Rooms] ADD [VisibleToUsers] BIT NOT NULL DEFAULT 1;
      IF COL_LENGTH('dbo.Rooms', 'VisibilityRole') IS NULL
        ALTER TABLE [dbo].[Rooms] ADD [VisibilityRole] NVARCHAR(50) NULL;
      IF COL_LENGTH('dbo.Rooms', 'HasUnresolvedMaintenance') IS NULL
        ALTER TABLE [dbo].[Rooms] ADD [HasUnresolvedMaintenance] BIT NOT NULL DEFAULT 0;
    `);

    // Seed default rooms if table is empty (to match frontend booking component IDs)
    const countResult = await pool.request().query(`SELECT COUNT(*) AS Cnt FROM [dbo].[Rooms]`);
    const count = countResult.recordset[0]?.Cnt ?? 0;
    if (count === 0) {
      await pool.request().query(`
        INSERT INTO [dbo].[Rooms] ([Name], [Type], [BasePrice], [Status], [VisibleToUsers])
        VALUES
          (N'Апартамент 1', N'Apartment', 99,  N'Available', 1),
          (N'Апартамент 2', N'Apartment', 149, N'Available', 1),
          (N'Апартамент 3', N'Apartment', 199, N'Available', 1),
          (N'Студио',       N'Studio',    249, N'Available', 1);
      `);
      console.log('Seeded default Rooms records');
    }

    console.log('Rooms table ready');
  } catch (error) {
    console.error('Error creating Rooms table:', error);
    throw error;
  }
}

async function createReservationsTable(pool: sql.ConnectionPool): Promise<void> {
  try {
    const query = `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Reservations]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[Reservations] (
          [Id] INT IDENTITY(1,1) PRIMARY KEY,
          [UserId] INT NULL,
          [RoomId] INT NULL,
          [StartDate] DATE NOT NULL,
          [EndDate] DATE NOT NULL,
          [Status] NVARCHAR(50) NOT NULL DEFAULT 'Pending', -- Pending, Approved, Rejected, Cancelled, Completed
          [TotalPrice] DECIMAL(18,2) NULL,
          [GuestFirstName] NVARCHAR(100) NULL,
          [GuestLastName] NVARCHAR(100) NULL,
          [GuestEmail] NVARCHAR(255) NULL,
          [GuestPhone] NVARCHAR(50) NULL,
          [Notes] NVARCHAR(MAX) NULL,
          [CreatedAt] DATETIME2 DEFAULT GETDATE(),
          [UpdatedAt] DATETIME2 DEFAULT GETDATE(),
          [CanceledAt] DATETIME2 NULL,
          CONSTRAINT FK_Reservations_Users FOREIGN KEY (UserId) REFERENCES [dbo].[Users](Id),
          CONSTRAINT FK_Reservations_Rooms FOREIGN KEY (RoomId) REFERENCES [dbo].[Rooms](Id)
        );
        CREATE INDEX IX_Reservations_UserId ON [dbo].[Reservations]([UserId]);
        CREATE INDEX IX_Reservations_RoomId ON [dbo].[Reservations]([RoomId]);
        CREATE INDEX IX_Reservations_Status ON [dbo].[Reservations]([Status]);
      END
    `;
    await pool.request().query(query);

    // Ensure new guest-related columns exist even if table was created earlier
    await pool.request().query(`
      IF COL_LENGTH('dbo.Reservations', 'GuestFirstName') IS NULL
        ALTER TABLE [dbo].[Reservations] ADD [GuestFirstName] NVARCHAR(100) NULL;
      IF COL_LENGTH('dbo.Reservations', 'GuestLastName') IS NULL
        ALTER TABLE [dbo].[Reservations] ADD [GuestLastName] NVARCHAR(100) NULL;
      IF COL_LENGTH('dbo.Reservations', 'GuestEmail') IS NULL
        ALTER TABLE [dbo].[Reservations] ADD [GuestEmail] NVARCHAR(255) NULL;
      IF COL_LENGTH('dbo.Reservations', 'GuestPhone') IS NULL
        ALTER TABLE [dbo].[Reservations] ADD [GuestPhone] NVARCHAR(50) NULL;
      IF COL_LENGTH('dbo.Reservations', 'Notes') IS NULL
        ALTER TABLE [dbo].[Reservations] ADD [Notes] NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.Reservations', 'CanceledBy') IS NULL
        ALTER TABLE [dbo].[Reservations] ADD [CanceledBy] NVARCHAR(20) NULL; -- 'User' or 'Admin'
    `);

    console.log('Reservations table ready');
  } catch (error) {
    console.error('Error creating Reservations table:', error);
    throw error;
  }
}

async function createRoomBlocksTable(pool: sql.ConnectionPool): Promise<void> {
  try {
    const query = `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[RoomBlocks]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[RoomBlocks] (
          [Id] INT IDENTITY(1,1) PRIMARY KEY,
          [RoomId] INT NOT NULL,
          [StartDate] DATE NOT NULL,
          [EndDate] DATE NOT NULL,
          [IsPermanent] BIT NOT NULL DEFAULT 0,
          [Reason] NVARCHAR(255) NULL,
          [CreatedByUserId] INT NOT NULL,
          [CreatedAt] DATETIME2 DEFAULT GETDATE(),
          CONSTRAINT FK_RoomBlocks_Rooms FOREIGN KEY (RoomId) REFERENCES [dbo].[Rooms](Id),
          CONSTRAINT FK_RoomBlocks_Users FOREIGN KEY (CreatedByUserId) REFERENCES [dbo].[Users](Id)
        );
        CREATE INDEX IX_RoomBlocks_RoomId ON [dbo].[RoomBlocks]([RoomId]);
      END
    `;
    await pool.request().query(query);
    console.log('RoomBlocks table ready');
  } catch (error) {
    console.error('Error creating RoomBlocks table:', error);
    throw error;
  }
}

async function createReservationNotesTable(pool: sql.ConnectionPool): Promise<void> {
  try {
    const query = `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ReservationNotes]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[ReservationNotes] (
          [Id] INT IDENTITY(1,1) PRIMARY KEY,
          [ReservationId] INT NOT NULL,
          [Note] NVARCHAR(MAX) NOT NULL,
          [CreatedByUserId] INT NOT NULL,
          [CreatedAt] DATETIME2 DEFAULT GETDATE(),
          CONSTRAINT FK_ReservationNotes_Reservations FOREIGN KEY (ReservationId) REFERENCES [dbo].[Reservations](Id),
          CONSTRAINT FK_ReservationNotes_Users FOREIGN KEY (CreatedByUserId) REFERENCES [dbo].[Users](Id)
        );
        CREATE INDEX IX_ReservationNotes_ReservationId ON [dbo].[ReservationNotes]([ReservationId]);
      END
    `;
    await pool.request().query(query);
    console.log('ReservationNotes table ready');
  } catch (error) {
    console.error('Error creating ReservationNotes table:', error);
    throw error;
  }
}

async function createAuditLogTable(pool: sql.ConnectionPool): Promise<void> {
  try {
    const query = `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AuditLogs]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[AuditLogs] (
          [Id] INT IDENTITY(1,1) PRIMARY KEY,
          [UserId] INT NOT NULL,
          [Action] NVARCHAR(255) NOT NULL,
          [EntityType] NVARCHAR(100) NOT NULL,
          [EntityId] INT NOT NULL,
          [Details] NVARCHAR(MAX) NULL,
          [CreatedAt] DATETIME2 DEFAULT GETDATE(),
          CONSTRAINT FK_AuditLogs_Users FOREIGN KEY (UserId) REFERENCES [dbo].[Users](Id)
        );
        CREATE INDEX IX_AuditLogs_Entity ON [dbo].[AuditLogs]([EntityType], [EntityId]);
      END
    `;
    await pool.request().query(query);
    console.log('AuditLogs table ready');
  } catch (error) {
    console.error('Error creating AuditLogs table:', error);
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
