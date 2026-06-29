const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

function requireCashier(req, res, next) {
  if (req.session.cashier) return next();
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

router.get('/', requireCashier, (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/cashier.html'));
});

// Scan QR → profil client
router.get('/scan/:qrCode', requireCashier, async (req, res) => {
  const pool = req.app.locals.pool;
  const { qrCode } = req.params;

  try {
    const clientRes = await pool.query(
      `SELECT c.*, 
        COUNT(v.id) as visit_count,
        MAX(v.visited_at) as last_visit
       FROM loyalty_clients c
       LEFT JOIN visits v ON v.client_id = c.id
       WHERE c.qr_code = $1 AND c.active = true
       GROUP BY c.id`,
      [qrCode]
    );

    if (clientRes.rows.length === 0) {
      return res.status(404).json({ error: 'Carte non reconnue.' });
    }

    const client = clientRes.rows[0];

    // Récupérer les dernières transactions SumUp proches du scan
    let recentTransactions = [];
    try {
      const now = new Date();
      const fiveMinAgo = new Date(now - 5 * 60 * 1000).toISOString();
      const sumupRes = await fetch(
        `https://api.sumup.com/v2.1/merchants/${process.env.SUMUP_MERCHANT_CODE}/transactions/history?newest_time=${now.toISOString()}&oldest_time=${fiveMinAgo}&limit=5`,
        { headers: { Authorization: `Bearer ${process.env.SUMUP_API_KEY}` } }
      );
      if (sumupRes.ok) {
        const data = await sumupRes.json();
        recentTransactions = (data.items || []).filter(t => t.status === 'SUCCESSFUL');
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

// Valider une visite + attacher transaction SumUp
router.post('/valider', requireCashier, async (req, res) => {
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
