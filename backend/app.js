//STANJE: GREŠKA KADA SE POKUŠAMO REGISTRIRATI, BROWSER KONZOLA GREŠKA


import express, { Router } from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import routes from './routes/index.js';
import AppError from './utils/errors.js';
import crypto from 'crypto';
import session from 'express-session';
import MySQLStore from 'express-mysql-session';
import cors from 'cors';

dotenv.config();
const app = express();

app.set('view engine', 'ejs');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

app.use(cors({
  origin: 'http://localhost:5173', // React dev server
  credentials: true // ⭐ BITNO! Allow cookies!
}));

const MySQLSessionStore = MySQLStore(session);
const sessionStore = new MySQLSessionStore({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    clearExpired: true,
    checkExpirationInterval: 900000,  // 15 min
    expiration: 30 * 24 * 60 * 60 * 1000,  // 30 dana
});

console.log('✅ MySQL Session Store konfiguriran');

app.use(session({
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // ⭐ LAX za dev!
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dana
  }
}));

app.use(routes);

app.use((error, req, res, next) => {
  
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      code: error.code
    });
  }
  
  // Default
  console.error('🔴 UNKNOWN ERROR:', error);
  if (error.stack) console.error(error.stack);
  return res.status(500).json({
    success: false,
    error: 'Desila se greška u sustavu',
    code: 'INTERNAL'
  });
});


app.listen(3000, () => {
    console.log('✅ Server running on http://localhost:3000');
});

export default app;
