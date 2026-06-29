require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.locals.pool = pool;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'soul-loyalty-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// Routes
app.use('/', require('./routes/register'));
app.use('/caisse', require('./routes/cashier'));
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/api'));

app.listen(PORT, () => console.log(`Soul Loyalty running on port ${PORT}`));
