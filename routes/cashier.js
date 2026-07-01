const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.redirect('/caisse/login');
}

router.get('/login', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/cashier-login.html'));
});

router.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.CASHIER_PASSWORD || password === process.env.ADMIN_PASSWORD) {
    req.session.cashier = true;
    if (password === process.env.ADMIN_PASSWORD) req.session.admin = true;
    res.redirect('/caisse');
  } else {
    res.redirect('/caisse/login?error=1');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/caisse/login');
});

// Caisse accessible sans mot de passe
router.get('/', (req, res) => {
  req.session.cashier = true;
  res.sendFile(require('path').join(__dirname, '../public/cashier.html'));
});

// Scan QR ou code court → profil client
router.get('/scan/:code', (req, res, next) => {
  req.session.cashier = true;
  next();
}, async (req, res) => {
  const pool = req.app.locals.pool;
  const { code } = req.params;

  try {
    const isFullUuid = code.length === 36;
    const query = isFullUuid
      ? `SELECT c.*, COUNT(v.id) as visit_count, MAX(v.visited_at) as last_visit
         FROM loyalty_clients c
         LEFT JOIN visits v ON v.client_id = c.id
         WHERE c.qr_code = $1 AND c.active = true
         GROUP BY c.id`
      : `SELECT c.*, COUNT(v.id) as visit_count, MAX(v.visited_at) as last_visit
         FROM loyalty_clients c
         LEFT JOIN visits v ON v.client_id = c.id
         WHERE UPPER(c.short_code) = UPPER($1) AND c.active = true
         GROUP BY c.id`;

    const clientRes = await pool.query(query, [code]);

    if (clientRes.rows.length === 0) {
      return res.status(404).json({ error: 'Carte non reconnue.' });
    }

    const client = clientRes.rows[0];

    let recentTransactions = [];
    try {
      // Récupérer le token SumUp depuis la base
      const tokenResult = await pool.query('SELECT access_token, expires_at FROM sumup_tokens WHERE id = 1');
      let sumupToken = process.env.SUMUP_API_KEY;
      if (tokenResult.rows.length > 0 && new Date(tokenResult.rows[0].expires_at) > new Date()) {
        sumupToken = tokenResult.rows[0].access_token;
      }

      const scanTime = new Date();
      const twoMinBefore = new Date(scanTime.getTime() - 2 * 60 * 1000).toISOString();
      const fiveMinAfter = new Date(scanTime.getTime() + 5 * 60 * 1000).toISOString();

      const sumupRes = await fetch(
        `https://api.sumup.com/v2.1/merchants/${process.env.SUMUP_MERCHANT_CODE}/transactions/history?newest_time=${fiveMinAfter}&oldest_time=${twoMinBefore}&limit=10`,
        { headers: { Authorization: `Bearer ${sumupToken}` } }
      );
      if (sumupRes.ok) {
        const data = await sumupRes.json();
        recentTransactions = (data.items || []).filter(t => ['SUCCESSFUL', 'PAID_OUT'].includes(t.status) && parseFloat(t.amount) > 0);
      }
    } catch (e) {
      console.error('SumUp API error:', e.message);
    }

    res.json({
      client: {
        id: client.id,
        first_name: client.first_name,
        last_name: client.last_name,
        visit_count: parseInt(client.visit_count),
        last_visit: client.last_visit,
        qr_code: client.qr_code
      },
      scanTime: new Date().toISOString(),
      recentTransactions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// Valider une visite
router.post('/valider', async (req, res) => {
  const pool = req.app.locals.pool;
  const { client_id, sumup_transaction_id, sumup_amount, sumup_products } = req.body;

  try {
    await pool.query(
      `INSERT INTO visits (client_id, sumup_transaction_id, sumup_amount, sumup_products, discount_applied)
       VALUES ($1, $2, $3, $4, true)`,
      [client_id, sumup_transaction_id || null, sumup_amount || null, sumup_products || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la validation.' });
  }
});

module.exports = router;
