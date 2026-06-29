const express = require('express');
const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.redirect('/caisse/login');
}

router.get('/', requireAdmin, (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/admin.html'));
});

// Liste de tous les clients
router.get('/clients', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(
      `SELECT c.*,
        COUNT(v.id) as visit_count,
        MAX(v.visited_at) as last_visit,
        SUM(v.sumup_amount) as total_spent
       FROM loyalty_clients c
       LEFT JOIN visits v ON v.client_id = c.id
       WHERE c.active = true
       GROUP BY c.id
       ORDER BY c.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Historique d'un client
router.get('/clients/:id/visites', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(
      `SELECT * FROM visits WHERE client_id = $1 ORDER BY visited_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stats globales
router.get('/stats', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const [clients, visits, topClients] = await Promise.all([
      pool.query('SELECT COUNT(*) as total FROM loyalty_clients WHERE active = true'),
      pool.query('SELECT COUNT(*) as total FROM visits'),
      pool.query(`
        SELECT c.first_name, c.last_name, COUNT(v.id) as visits
        FROM loyalty_clients c
        JOIN visits v ON v.client_id = c.id
        GROUP BY c.id, c.first_name, c.last_name
        ORDER BY visits DESC LIMIT 5
      `)
    ]);
    res.json({
      total_clients: clients.rows[0].total,
      total_visits: visits.rows[0].total,
      top_clients: topClients.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Désactiver un client
router.post('/clients/:id/desactiver', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    await pool.query('UPDATE loyalty_clients SET active = false WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
