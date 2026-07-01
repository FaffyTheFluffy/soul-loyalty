const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Étape 1 : Rediriger vers SumUp
router.get('/sumup', (req, res) => {
  if (!req.session.admin) return res.redirect('/caisse/login');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SUMUP_CLIENT_ID,
    redirect_uri: `${process.env.APP_URL}/auth/sumup/callback`,
    scope: 'transactions.history'
  });
  res.redirect(`https://api.sumup.com/authorize?${params}`);
});

// Étape 2 : Callback — stocker le token EN BASE DE DONNÉES
router.get('/sumup/callback', async (req, res) => {
  const pool = req.app.locals.pool;
  const { code, error } = req.query;
  if (error || !code) return res.redirect('/admin?sumup_error=1');

  try {
    const tokenRes = await fetch('https://api.sumup.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.SUMUP_CLIENT_ID,
        client_secret: process.env.SUMUP_CLIENT_SECRET,
        redirect_uri: `${process.env.APP_URL}/auth/sumup/callback`,
        code
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('SumUp token error:', tokenData);
      return res.redirect('/admin?sumup_error=1');
    }

    const expiry = new Date(Date.now() + tokenData.expires_in * 1000);

    // Upsert token en base
    await pool.query(`
      INSERT INTO sumup_tokens (id, access_token, refresh_token, expires_at)
      VALUES (1, $1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `, [tokenData.access_token, tokenData.refresh_token, expiry]);

    res.redirect('/admin?sumup_connected=1');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/admin?sumup_error=1');
  }
});

// Endpoint interne : fournir un token valide à la caisse
router.get('/sumup/token', async (req, res) => {
  if (!req.session.cashier) return res.status(401).json({ error: 'Non autorisé' });

  const pool = req.app.locals.pool;
  try {
    const result = await pool.query('SELECT * FROM sumup_tokens WHERE id = 1');
    if (!result.rows.length) return res.status(401).json({ error: 'SumUp non connecté', needs_auth: true });

    const token = result.rows[0];
    const now = new Date();

    // Token encore valide
    if (new Date(token.expires_at) > new Date(now.getTime() + 60000)) {
      return res.json({ access_token: token.access_token });
    }

    // Refresh
    const refreshRes = await fetch('https://api.sumup.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: process.env.SUMUP_CLIENT_ID,
        client_secret: process.env.SUMUP_CLIENT_SECRET,
        refresh_token: token.refresh_token
      })
    });
    const data = await refreshRes.json();
    if (!data.access_token) return res.status(401).json({ error: 'Token expiré', needs_auth: true });

    const newExpiry = new Date(Date.now() + data.expires_in * 1000);
    await pool.query(`
      UPDATE sumup_tokens SET access_token=$1, refresh_token=$2, expires_at=$3, updated_at=NOW() WHERE id=1
    `, [data.access_token, data.refresh_token || token.refresh_token, newExpiry]);

    res.json({ access_token: data.access_token });
  } catch (err) {
    console.error('Token fetch error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
