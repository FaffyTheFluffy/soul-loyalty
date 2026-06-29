const express = require('express');
const router = express.Router();

// Endpoint encodé dans le QR code — vérifie que la carte est valide
router.get('/client/:qrCode', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const result = await pool.query(
      'SELECT first_name, last_name FROM loyalty_clients WHERE qr_code = $1 AND active = true',
      [req.params.qrCode]
    );
    if (result.rows.length === 0) {
      return res.status(404).send('Carte non reconnue.');
    }
    // Rediriger vers la page caissier avec le QR code pré-rempli
    res.redirect(`/caisse?scan=${req.params.qrCode}`);
  } catch (err) {
    res.status(500).send('Erreur serveur.');
  }
});

module.exports = router;
