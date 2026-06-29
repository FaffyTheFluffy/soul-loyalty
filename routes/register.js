const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

// Page d'inscription publique
router.get('/', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/register.html'));
});

// Soumission du formulaire
router.post('/inscription', async (req, res) => {
  const pool = req.app.locals.pool;
  const { first_name, last_name, phone, email, gender, birth_date, rgpd } = req.body;

  if (!first_name || !last_name || !rgpd) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }

  try {
    // Vérifier si email déjà inscrit
    if (email) {
      const existing = await pool.query(
        'SELECT id FROM loyalty_clients WHERE email = $1',
        [email]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Cette adresse email est déjà inscrite.' });
      }
    }

    const qrCode = uuidv4();
    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const qrData = `${appUrl}/api/client/${qrCode}`;

    await pool.query(
      `INSERT INTO loyalty_clients 
       (first_name, last_name, phone, email, gender, birth_date, qr_code, rgpd_accepted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [first_name, last_name, phone || null, email || null, gender || null, birth_date || null, qrCode]
    );

    // Générer QR code en base64
    const qrImageUrl = await QRCode.toDataURL(qrData, {
      width: 400,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' }
    });

    res.json({ success: true, qrCode, qrImageUrl, firstName: first_name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur. Réessayez.' });
  }
});

module.exports = router;
