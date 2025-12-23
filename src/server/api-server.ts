import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getDbConnection, initializeDatabase } from './db.config';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
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
import { getPublicBaseUrl, normalizeImageUrl, renderBrandedEmail, escapeHtml } from './email-template';

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

// Email translations
const emailTranslations = {
  en: {
    reservationRequest: {
      subject: 'Reservation request for {roomName} ({checkIn} - {checkOut})',
      guestSubject: 'Your reservation request for {roomName}',
      title: 'Your reservation request is received!',
      preheader: 'Reservation request for {roomName} ({checkIn} – {checkOut})',
      greeting: 'Dear {guestName},',
      body: 'We have received your reservation request for <strong>{roomName}</strong> from <strong>{checkIn}</strong> to <strong>{checkOut}</strong>.',
      footer: 'We will contact you shortly to confirm availability.',
      closing: 'Best regards,<br/>Aurora Hotel',
      textBody: 'Dear {guestName},\n\nWe have received your reservation request for {roomName} from {checkIn} to {checkOut}.\nWe will contact you shortly to confirm availability.\n\nBest regards,\nAurora Hotel',
      staffTitle: 'New reservation request',
      staffPreheader: 'New reservation request for {roomName}',
      guest: 'Guest',
      email: 'Email',
      phone: 'Phone',
      room: 'Room',
      dates: 'Dates',
      pricePerNight: 'Price per night',
      notProvided: 'Not provided',
      reservationRequest: 'Reservation request',
      bookingId: 'Booking ID: {bookingCode}'
    },
    statusUpdate: {
      approved: {
        subject: 'Reservation Approved - {roomName}',
        title: 'Reservation Approved',
        preheader: 'Your reservation for {roomName} is approved',
        greeting: 'Dear {userName},',
        body: 'Your reservation for <strong>{roomName}</strong> from <strong>{checkIn}</strong> to <strong>{checkOut}</strong> has been <strong>approved</strong>.',
        footer: 'We look forward to welcoming you!',
        closing: 'Best regards,<br/>Aurora Hotel',
        textBody: 'Dear {userName},\n\nYour reservation for {roomName} from {checkIn} to {checkOut} has been approved.\n\nWe look forward to welcoming you!\n\nBest regards,\nAurora Hotel'
      },
      rejected: {
        subject: 'Reservation Update - {roomName}',
        title: 'Reservation Update',
        preheader: 'Your reservation for {roomName} was rejected',
        greeting: 'Dear {userName},',
        body: 'Unfortunately, your reservation request for <strong>{roomName}</strong> from <strong>{checkIn}</strong> to <strong>{checkOut}</strong> has been <strong>rejected</strong>.',
        footer: 'Please contact us if you have any questions or would like to make a new reservation.',
        closing: 'Best regards,<br/>Aurora Hotel',
        textBody: 'Dear {userName},\n\nUnfortunately, your reservation request for {roomName} from {checkIn} to {checkOut} has been rejected.\n\nPlease contact us if you have any questions or would like to make a new reservation.\n\nBest regards,\nAurora Hotel'
      },
      cancelled: {
        subject: 'Reservation Cancelled - {roomName}',
        title: 'Reservation Cancelled',
        preheader: 'Your reservation for {roomName} was cancelled',
        greeting: 'Dear {userName},',
        body: 'Your reservation for <strong>{roomName}</strong> from <strong>{checkIn}</strong> to <strong>{checkOut}</strong> has been <strong>cancelled</strong> by the administration.',
        footer: 'If you have any questions, please contact us.',
        closing: 'Best regards,<br/>Aurora Hotel',
        textBody: 'Dear {userName},\n\nYour reservation for {roomName} from {checkIn} to {checkOut} has been cancelled by the administration.\n\nIf you have any questions, please contact us.\n\nBest regards,\nAurora Hotel'
      }
    }
  },
  bg: {
    reservationRequest: {
      subject: 'Заявка за резервация за {roomName} ({checkIn} - {checkOut})',
      guestSubject: 'Вашата заявка за резервация за {roomName}',
      title: 'Вашата заявка за резервация е получена!',
      preheader: 'Заявка за резервация за {roomName} ({checkIn} – {checkOut})',
      greeting: 'Уважаеми/а {guestName},',
      body: 'Получихме вашата заявка за резервация за <strong>{roomName}</strong> от <strong>{checkIn}</strong> до <strong>{checkOut}</strong>.',
      footer: 'Ще се свържем с вас скоро, за да потвърдим наличността.',
      closing: 'С уважение,<br/>Хотел Аврора',
      textBody: 'Уважаеми/а {guestName},\n\nПолучихме вашата заявка за резервация за {roomName} от {checkIn} до {checkOut}.\nЩе се свържем с вас скоро, за да потвърдим наличността.\n\nС уважение,\nХотел Аврора',
      staffTitle: 'Нова заявка за резервация',
      staffPreheader: 'Нова заявка за резервация за {roomName}',
      guest: 'Гост',
      email: 'Имейл',
      phone: 'Телефон',
      room: 'Стая',
      dates: 'Дати',
      pricePerNight: 'Цена на нощ',
      notProvided: 'Не е предоставен',
      reservationRequest: 'Заявка за резервация',
      bookingId: 'Номер на резервация: {bookingCode}'
    },
    statusUpdate: {
      approved: {
        subject: 'Резервация одобрена - {roomName}',
        title: 'Резервация одобрена',
        preheader: 'Вашата резервация за {roomName} е одобрена',
        greeting: 'Уважаеми/а {userName},',
        body: 'Вашата резервация за <strong>{roomName}</strong> от <strong>{checkIn}</strong> до <strong>{checkOut}</strong> е <strong>одобрена</strong>.',
        footer: 'Очакваме с нетърпение да ви приветстваме!',
        closing: 'С уважение,<br/>Хотел Аврора',
        textBody: 'Уважаеми/а {userName},\n\nВашата резервация за {roomName} от {checkIn} до {checkOut} е одобрена.\n\nОчакваме с нетърпение да ви приветстваме!\n\nС уважение,\nХотел Аврора'
      },
      rejected: {
        subject: 'Актуализация на резервация - {roomName}',
        title: 'Актуализация на резервация',
        preheader: 'Вашата резервация за {roomName} беше отхвърлена',
        greeting: 'Уважаеми/а {userName},',
        body: 'За съжаление, вашата заявка за резервация за <strong>{roomName}</strong> от <strong>{checkIn}</strong> до <strong>{checkOut}</strong> беше <strong>отхвърлена</strong>.',
        footer: 'Моля, свържете се с нас, ако имате въпроси или искате да направите нова резервация.',
        closing: 'С уважение,<br/>Хотел Аврора',
        textBody: 'Уважаеми/а {userName},\n\nЗа съжаление, вашата заявка за резервация за {roomName} от {checkIn} до {checkOut} беше отхвърлена.\n\nМоля, свържете се с нас, ако имате въпроси или искате да направите нова резервация.\n\nС уважение,\nХотел Аврора'
      },
      cancelled: {
        subject: 'Резервация отменена - {roomName}',
        title: 'Резервация отменена',
        preheader: 'Вашата резервация за {roomName} беше отменена',
        greeting: 'Уважаеми/а {userName},',
        body: 'Вашата резервация за <strong>{roomName}</strong> от <strong>{checkIn}</strong> до <strong>{checkOut}</strong> беше <strong>отменена</strong> от администрацията.',
        footer: 'Ако имате въпроси, моля, свържете се с нас.',
        closing: 'С уважение,<br/>Хотел Аврора',
        textBody: 'Уважаеми/а {userName},\n\nВашата резервация за {roomName} от {checkIn} до {checkOut} беше отменена от администрацията.\n\nАко имате въпроси, моля, свържете се с нас.\n\nС уважение,\nХотел Аврора'
      }
    }
  }
};

function translateEmail(template: string, params: Record<string, string>, lang: 'en' | 'bg' = 'en'): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

async function sendReservationEmails(options: {
  guestEmail: string;
  guestName: string;
  guestPhone?: string | null;
  roomName: string;
  roomPrice?: number | null;
  checkIn: string;
  checkOut: string;
  bookingCode?: string | null;
  language?: 'en' | 'bg';
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
    checkOut,
    bookingCode,
    language = 'en'
  } = options;

  const lang = (language === 'bg' ? 'bg' : 'en') as 'en' | 'bg';
  const t = emailTranslations[lang].reservationRequest;

  const subject = translateEmail(t.subject, { roomName, checkIn, checkOut });
  const baseUrl = getPublicBaseUrl();
  const brandLogo = normalizeImageUrl('/images/hotel-logo.png', baseUrl);
  const bookingIdText = bookingCode ? translateEmail(t.bookingId, { bookingCode }) + '\n\n' : '';
  const textBody = (
    translateEmail(t.reservationRequest, {}) + '\n\n' +
    bookingIdText +
    `${t.guest}: ${guestName}\n` +
    `${t.email}: ${guestEmail}\n` +
    `${t.phone}: ${guestPhone || t.notProvided}\n\n` +
    `${t.room}: ${roomName}\n` +
    `${t.pricePerNight}: ${roomPrice ?? 'N/A'}\n` +
    `${t.dates}: ${checkIn} - ${checkOut}\n`
  ).trim();

  const htmlGuest = renderBrandedEmail({
    title: translateEmail(t.title, {}),
    preheader: translateEmail(t.preheader, { roomName, checkIn, checkOut }),
    bookingCode: bookingCode || null,
    logoUrl: brandLogo,
    footerText: `Aurora Hotel • ${HOTEL_EMAIL}`,
    bodyHtml:
      `<p style="margin:0 0 12px 0;">${translateEmail(t.greeting, { guestName: escapeHtml(guestName) })}</p>` +
      `<p style="margin:0 0 12px 0;">${translateEmail(t.body, { roomName: escapeHtml(roomName), checkIn: escapeHtml(checkIn), checkOut: escapeHtml(checkOut) })}</p>` +
      `<p style="margin:0 0 12px 0;">${translateEmail(t.footer, {})}</p>` +
      `<p style="margin:0;">${translateEmail(t.closing, {})}</p>`
  });

  const htmlStaff = renderBrandedEmail({
    title: translateEmail(t.staffTitle, {}),
    preheader: translateEmail(t.staffPreheader, { roomName }),
    bookingCode: bookingCode || null,
    logoUrl: brandLogo,
    footerText: `Aurora Hotel • ${HOTEL_EMAIL}`,
    bodyHtml:
      `<table role="presentation" width="100%" style="border-collapse:collapse;margin-top:6px;">` +
      `<tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;font-weight:800;">${t.guest}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;">${escapeHtml(guestName)}</td></tr>` +
      `<tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;font-weight:800;">${t.email}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;">${escapeHtml(guestEmail)}</td></tr>` +
      `<tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;font-weight:800;">${t.phone}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;">${escapeHtml(guestPhone || t.notProvided)}</td></tr>` +
      `<tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;font-weight:800;">${t.room}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;">${escapeHtml(roomName)}</td></tr>` +
      `<tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;font-weight:800;">${t.dates}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;">${escapeHtml(checkIn)} – ${escapeHtml(checkOut)}</td></tr>` +
      `<tr><td style="padding:10px 0;color:#111827;font-weight:800;">${t.pricePerNight}</td><td align="right" style="padding:10px 0;color:#111827;">${escapeHtml(String(roomPrice ?? 'N/A'))}</td></tr>` +
      `</table>`
  });

  // Email to guest
  await mailTransporter.sendMail({
    from: `"Aurora Hotel" <${HOTEL_EMAIL}>`,
    to: guestEmail,
    subject: translateEmail(t.guestSubject, { roomName }),
    text: translateEmail(t.textBody, { guestName, roomName, checkIn, checkOut }),
    html: htmlGuest
  });

  // Email to hotel (always in English for staff)
  const tStaff = emailTranslations.en.reservationRequest;
  await mailTransporter.sendMail({
    from: `"Aurora Hotel Website" <${HOTEL_EMAIL}>`,
    to: HOTEL_EMAIL,
    subject: translateEmail(tStaff.subject, { roomName, checkIn, checkOut }),
    text: textBody,
    html: htmlStaff
  });
}

async function sendContactFormEmail(options: {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}) {
  if (!mailTransporter) {
    throw new Error('Email not configured: set SMTP_USER and SMTP_PASS (and SMTP_HOST/SMTP_PORT if not using Gmail).');
  }
  if (!HOTEL_EMAIL) {
    throw new Error('Email not configured: set HOTEL_EMAIL (or SMTP_USER).');
  }

  const { name, email, phone, subject, message } = options;

  const baseUrl = getPublicBaseUrl();
  const brandLogo = normalizeImageUrl('/images/hotel-logo.png', baseUrl);

  // Map subject values to readable text
  const subjectMap: { [key: string]: string } = {
    'generalInquiry': 'General Inquiry',
    'reservationQuestion': 'Reservation Question',
    'complaint': 'Complaint',
    'feedback': 'Feedback',
    'other': 'Other'
  };
  const subjectText = subjectMap[subject] || subject;
  const emailSubject = `New Contact Form Submission: ${subjectText} - ${name}`;

  // Email to hotel
  await mailTransporter.sendMail({
    from: `"Aurora Hotel Website" <${HOTEL_EMAIL}>`,
    to: HOTEL_EMAIL,
    subject: emailSubject,
    text:
      `New contact form submission\n\n` +
      `Name: ${name}\n` +
      `Email: ${email}\n` +
      `Phone: ${phone}\n` +
      `Subject: ${subjectText}\n\n` +
      `Message:\n${message}\n`
    ,
    html: renderBrandedEmail({
      title: 'New Contact Form Submission',
      preheader: `New message from ${name}`,
      logoUrl: brandLogo,
      footerText: `Aurora Hotel • ${HOTEL_EMAIL}`,
      bodyHtml:
        `<table role="presentation" width="100%" style="border-collapse:collapse;margin-top:6px;">` +
        `<tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;font-weight:800;">Name</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;">${escapeHtml(name)}</td></tr>` +
        `<tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;font-weight:800;">Email</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;">${escapeHtml(email)}</td></tr>` +
        `<tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;font-weight:800;">Phone</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;">${escapeHtml(phone)}</td></tr>` +
        `<tr><td style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;font-weight:800;">Subject</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eef2f7;color:#111827;">${escapeHtml(subjectText)}</td></tr>` +
        `</table>` +
        `<div style="margin-top:14px;color:#111827;font-weight:800;">Message</div>` +
        `<div style="margin-top:6px;color:#374151;white-space:pre-wrap;">${escapeHtml(message)}</div>`
    })
  });

  // Confirmation email to customer
  await mailTransporter.sendMail({
    from: `"Aurora Hotel" <${HOTEL_EMAIL}>`,
    to: email,
    subject: `Thank you for contacting Aurora Hotel - ${subjectText}`,
    text:
      `Dear ${name},\n\n` +
      `Thank you for contacting Aurora Hotel. We have received your message regarding "${subjectText}" and will get back to you as soon as possible.\n\n` +
      `Subject: ${subjectText}\n` +
      `Your message:\n${message}\n\n` +
      `Best regards,\nAurora Hotel Team`
    ,
    html: renderBrandedEmail({
      title: 'Thank You for Contacting Us',
      preheader: 'We have received your message',
      logoUrl: brandLogo,
      footerText: `Aurora Hotel • ${HOTEL_EMAIL}`,
      bodyHtml:
        `<p style="margin:0 0 12px 0;">Dear ${escapeHtml(name)},</p>` +
        `<p style="margin:0 0 12px 0;">Thank you for contacting Aurora Hotel. We have received your message regarding <strong>${escapeHtml(subjectText)}</strong> and will get back to you as soon as possible.</p>` +
        `<div style="margin-top:14px;padding:12px;background:#f9fafb;border-radius:6px;border-left:3px solid #3b82f6;">` +
        `<div style="color:#111827;font-weight:800;margin-bottom:6px;">Subject: ${escapeHtml(subjectText)}</div>` +
        `<div style="color:#111827;font-weight:800;margin-top:12px;margin-bottom:6px;">Your message:</div>` +
        `<div style="color:#374151;white-space:pre-wrap;">${escapeHtml(message)}</div>` +
        `</div>` +
        `<p style="margin:12px 0 0 0;">Best regards,<br/>Aurora Hotel Team</p>`
    })
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
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Validation
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    let supabase;
    try {
      supabase = await getDbConnection();
    } catch (dbError: any) {
      console.error('Database connection failed:', dbError);
      res.status(500).json({ 
        error: 'Database connection failed. Please check your Supabase configuration.',
        details: process.env['NODE_ENV'] === 'development' ? dbError.message : undefined
      });
      return;
    }

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
    const token = await new SignJWT({ userId: user.id, email: user.email })
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
      res.status(400).json({ error: 'Email and password are required' });
    }

    let supabase;
    try {
      supabase = await getDbConnection();
    } catch (dbError: any) {
      console.error('Database connection failed:', dbError);
      res.status(500).json({ 
        error: 'Database connection failed. Please check your Supabase configuration.',
        details: process.env['NODE_ENV'] === 'development' ? dbError.message : undefined
      });
      return;
    }

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
      res.status(500).json({ error: 'Email already in use' });
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
    if (newPassword && newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
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

    if (!newPassword) {
      res.status(400).json({ error: 'New password is required' });
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
          *,
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
        BookingCode: r.booking_code || null,
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
  async (req: AuthRequest, res): Promise<void> => {
    const reservationId = Number(req.params['id']);
    const { status } = req.body as { status?: string };

    if (
      !status ||
      !['Pending', 'Approved', 'Rejected', 'Cancelled', 'Completed'].includes(status)
    ) {
      res.status(400).json({ error: 'Invalid status' });
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
      
      // Get user email for notification
      const { data: reservationData, error: fetchError } = await supabase
        .from('reservations')
        .select(`
          *,
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
        // Supabase joins return arrays, so we need to access the first element
        const user = Array.isArray(reservationData.users) ? reservationData.users[0] : reservationData.users;
        const room = Array.isArray(reservationData.rooms) ? reservationData.rooms[0] : reservationData.rooms;
        const userEmail = user?.email || reservationData.guest_email;
        const userName = user 
          ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
          : `${reservationData.guest_first_name || ''} ${reservationData.guest_last_name || ''}`.trim() || 'Guest';
        const roomName = room?.name || 'Room';
        const checkIn = new Date(reservationData.start_date).toLocaleDateString();
        const checkOut = new Date(reservationData.end_date).toLocaleDateString();
        const bookingCode: string | null = (reservationData as any)?.booking_code || null;
        const baseUrl = getPublicBaseUrl();
        const brandLogo = normalizeImageUrl('/images/hotel-logo.png', baseUrl);

        if (userEmail && status && ['Approved', 'Rejected', 'Cancelled'].includes(status)) {
          try {
            let userLanguage: 'en' | 'bg' = 'en';
            if (reservationData.user_id) {
              try {
                const { data: userPrefs } = await supabase
                  .from('users')
                  .select('language, preferred_language')
                  .eq('id', reservationData.user_id)
                  .single();
                const lang = userPrefs?.language || userPrefs?.preferred_language;
                if (lang === 'bg' || lang === 'en') {
                  userLanguage = lang;
                }
              } catch (err) {
                console.log('Could not fetch user language preference, defaulting to English');
              }
            }

            const t = emailTranslations[userLanguage].statusUpdate;
            let emailTemplate;
            let subject = '';
            let textBody = '';
            let htmlBody = '';

            if (status === 'Approved') {
              emailTemplate = t.approved;
              subject = translateEmail(emailTemplate.subject, { roomName });
              textBody = translateEmail(emailTemplate.textBody, { userName, roomName, checkIn, checkOut });
              htmlBody = renderBrandedEmail({
                title: translateEmail(emailTemplate.title, {}),
                preheader: translateEmail(emailTemplate.preheader, { roomName }),
                bookingCode,
                logoUrl: brandLogo,
                footerText: `Aurora Hotel • ${HOTEL_EMAIL}`,
                bodyHtml:
                  `<p style="margin:0 0 12px 0;">${translateEmail(emailTemplate.greeting, { userName: escapeHtml(userName) })}</p>` +
                  `<p style="margin:0 0 12px 0;">${translateEmail(emailTemplate.body, { roomName: escapeHtml(roomName), checkIn: escapeHtml(checkIn), checkOut: escapeHtml(checkOut) })}</p>` +
                  `<p style="margin:0 0 12px 0;">${translateEmail(emailTemplate.footer, {})}</p>` +
                  `<p style="margin:0;">${translateEmail(emailTemplate.closing, {})}</p>`
              });
            } else if (status === 'Rejected') {
              emailTemplate = t.rejected;
              subject = translateEmail(emailTemplate.subject, { roomName });
              textBody = translateEmail(emailTemplate.textBody, { userName, roomName, checkIn, checkOut });
              htmlBody = renderBrandedEmail({
                title: translateEmail(emailTemplate.title, {}),
                preheader: translateEmail(emailTemplate.preheader, { roomName }),
                bookingCode,
                logoUrl: brandLogo,
                footerText: `Aurora Hotel • ${HOTEL_EMAIL}`,
                bodyHtml:
                  `<p style="margin:0 0 12px 0;">${translateEmail(emailTemplate.greeting, { userName: escapeHtml(userName) })}</p>` +
                  `<p style="margin:0 0 12px 0;">${translateEmail(emailTemplate.body, { roomName: escapeHtml(roomName), checkIn: escapeHtml(checkIn), checkOut: escapeHtml(checkOut) })}</p>` +
                  `<p style="margin:0 0 12px 0;">${translateEmail(emailTemplate.footer, {})}</p>` +
                  `<p style="margin:0;">${translateEmail(emailTemplate.closing, {})}</p>`
              });
            } else if (status === 'Cancelled') {
              emailTemplate = t.cancelled;
              subject = translateEmail(emailTemplate.subject, { roomName });
              textBody = translateEmail(emailTemplate.textBody, { userName, roomName, checkIn, checkOut });
              htmlBody = renderBrandedEmail({
                title: translateEmail(emailTemplate.title, {}),
                preheader: translateEmail(emailTemplate.preheader, { roomName }),
                bookingCode,
                logoUrl: brandLogo,
                footerText: `Aurora Hotel • ${HOTEL_EMAIL}`,
                bodyHtml:
                  `<p style="margin:0 0 12px 0;">${translateEmail(emailTemplate.greeting, { userName: escapeHtml(userName) })}</p>` +
                  `<p style="margin:0 0 12px 0;">${translateEmail(emailTemplate.body, { roomName: escapeHtml(roomName), checkIn: escapeHtml(checkIn), checkOut: escapeHtml(checkOut) })}</p>` +
                  `<p style="margin:0 0 12px 0;">${translateEmail(emailTemplate.footer, {})}</p>` +
                  `<p style="margin:0;">${translateEmail(emailTemplate.closing, {})}</p>`
              });
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
      
      // Transform to match expected format
      const transformed = {
        Id: updatedReservation.id,
        BookingCode: (updatedReservation as any)?.booking_code || null,
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

      // Emit real-time update to all connected clients (use transformed shape expected by UI)
      io.emit('reservation-status-updated', {
        reservationId,
        status,
        reservation: transformed
      });

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

/**
 * Public reservation endpoint used by the booking page.
 * Stores reservation in the Reservations table so it is visible in the admin panel.
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
      userId,
      language
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
      language?: 'en' | 'bg';
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

    // Try to send emails, but do not fail the reservation if email sending fails
    try {
      const bookingCode =
        (reservation as any)?.booking_code ||
        (reservation?.id != null ? String(reservation.id).padStart(4, '0') : null);
      await sendReservationEmails({
        guestEmail: email!,
        guestName: `${firstName} ${lastName}`,
        guestPhone: phone,
        roomName: roomName || 'Room',
        roomPrice: pricePerNight ?? null,
        checkIn: start.toLocaleDateString(),
        checkOut: end.toLocaleDateString(),
        bookingCode,
        language: (language === 'bg' ? 'bg' : 'en')
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
 * Public contact form endpoint
 */
app.post('/api/public/contact', async (req, res): Promise<void> => {
  try {
    const { name, email, phone, subject, message } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      subject?: string;
      message?: string;
    };

    // Validate required fields
    if (!name || !email || !phone || !subject || !message) {
      res.status(400).json({ error: 'Missing required fields: name, email, phone, subject, and message are required' });
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Validate message length
    if (message.length < 10) {
      res.status(400).json({ error: 'Message must be at least 10 characters long' });
      return;
    }

    // Send emails
    try {
      await sendContactFormEmail({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        subject: subject.trim(),
        message: message.trim()
      });

      res.status(200).json({ 
        success: true, 
        message: 'Your message has been sent successfully. We will get back to you soon.' 
      });
    } catch (emailError: any) {
      console.error('Error sending contact form email:', emailError);
      // If email fails, still return success to user (email might be misconfigured)
      // but log the error for admin
      res.status(200).json({ 
        success: true, 
        message: 'Your message has been received. We will get back to you soon.' 
      });
    }
  } catch (error: any) {
    console.error('Error processing contact form:', error);
    res.status(500).json({ error: 'Failed to process contact form submission' });
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
        *,
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
      BookingCode: r.booking_code || null,
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
    }

    // Don't allow users to cancel approved reservations
    if (reservation.status === 'Approved') {
      res.status(400).json({ error: 'Cannot cancel an approved reservation. Please contact support.' });
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
      reservation: {
        Id: cancelledReservation.id,
        BookingCode: (cancelledReservation as any)?.booking_code || null,
        Status: cancelledReservation.status,
        CanceledAt: cancelledReservation.canceled_at,
        CanceledBy: cancelledReservation.canceled_by
      }
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
 * Supabase Storage API Endpoints
 * These endpoints handle file storage operations using Supabase Storage
 */

// Upload file endpoint
app.post(
  '/api/storage/upload',
  authMiddleware,
  requireRole(['Manager', 'SuperAdmin', 'Support']),
  upload.single('file'),
  async (req: AuthRequest, res): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file provided' });
        return;
      }

      const { bucket, path } = req.body as { bucket?: string; path?: string };

      if (!bucket || !Object.values(STORAGE_BUCKETS).includes(bucket as any)) {
        res.status(400).json({
          error: 'Invalid bucket. Valid buckets: ' + Object.values(STORAGE_BUCKETS).join(', ')
        });
        return;
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
app.delete('/api/storage/delete', authMiddleware, requireRole(['Manager', 'SuperAdmin']), async (req: AuthRequest, res): Promise<void> => {
  try {
    const { bucket, path } = req.body as { bucket?: string; path?: string };

    if (!bucket || !path) {
      res.status(400).json({ error: 'Bucket and path are required' });
    }

    if (!Object.values(STORAGE_BUCKETS).includes(bucket as any)) {
      res.status(400).json({ error: 'Invalid bucket' });
    }

    await deleteFile(bucket!, path!);

    res.json({ message: 'File deleted successfully' });
  } catch (error: any) {
    console.error('File delete error:', error);
    res.status(500).json({ error: 'Failed to delete file', details: error.message });
  }
});

// List files endpoint
app.get('/api/storage/list', authMiddleware, requireRole(['Manager', 'SuperAdmin', 'Support']), async (req: AuthRequest, res): Promise<void> => {
  try {
    const { bucket, path, limit, offset } = req.query as {
      bucket?: string;
      path?: string;
      limit?: string;
      offset?: string;
    };

    if (!bucket) {
      res.status(400).json({ error: 'Bucket is required' });
      return;
    }

    if (!Object.values(STORAGE_BUCKETS).includes(bucket as any)) {
      res.status(400).json({ error: 'Invalid bucket' });
      return;
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
app.get('/api/storage/url', (req, res): void => {
  try {
    const { bucket, path } = req.query as { bucket?: string; path?: string };

    if (!bucket || !path) {
      res.status(400).json({ error: 'Bucket and path are required' });
    }

    if (!Object.values(STORAGE_BUCKETS).includes(bucket as any)) {
      res.status(400).json({ error: 'Invalid bucket' });
    }

    const url = getPublicUrl(bucket!, path!);
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
  async (req: AuthRequest, res): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No image provided' });
        return;
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

