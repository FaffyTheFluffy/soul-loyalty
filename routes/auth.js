const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// Étape 1 : Rediriger vers SumUp pour autorisation
router.get('/sumup', (req, res) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SUMUP_CLIENT_ID,
    redirect_uri: `${process.env.APP_URL}/auth/sumup/callback`,
    scope: 'transactions.history'
  });
  res.redirect(`https://api.sumup.com/authorize?${params}`);
});

// Étape 2 : Callback SumUp → échange du code contre un token
router.get('/sumup/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect('/admin?sumup_error=1');
  }

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

    // Stocker le token en session (valide ~60 min)
    req.session.sumup_access_token = tokenData.access_token;
    req.session.sumup_refresh_token = tokenData.refresh_token;
    req.session.sumup_token_expiry = Date.now() + (tokenData.expires_in * 1000);

    res.redirect('/admin?sumup_connected=1');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.redirect('/admin?sumup_error=1');
  }
});

// Endpoint interne : récupérer un token valide (avec refresh si besoin)
router.get('/sumup/token', async (req, res) => {
  if (!req.session.cashier) return res.status(401).json({ error: 'Non autorisé' });

  const now = Date.now();
  const expiry = req.session.sumup_token_expiry || 0;
  const accessToken = req.session.sumup_access_token;
  const refreshToken = req.session.sumup_refresh_token;

  // Token encore valide
  if (accessToken && now < expiry - 60000) {
    return res.json({ access_token: accessToken });
  }

  // Refresh du token
  if (refreshToken) {
    try {
      const refreshRes = await fetch('https://api.sumup.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: process.env.SUMUP_CLIENT_ID,
          client_secret: process.env.SUMUP_CLIENT_SECRET,
          refresh_token: refreshToken
        })
      });
      const data = await refreshRes.json();
      if (data.access_token) {
        req.session.sumup_access_token = data.access_token;
        req.session.sumup_refresh_token = data.refresh_token || refreshToken;
        req.session.sumup_token_expiry = Date.now() + (data.expires_in * 1000);
        return res.json({ access_token: data.access_token });
      }
    } catch (e) {
      console.error('Refresh error:', e);
    }
  }

  res.status(401).json({ error: 'SumUp non connecté', needs_auth: true });
});

module.exports = router;
