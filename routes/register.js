const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');

router.get('/', (req, res) => {
  res.sendFile(require('path').join(__dirname, '../public/register.html'));
});

router.post('/inscription', async (req, res) => {
  const pool = req.app.locals.pool;
  const { first_name, last_name, phone, email, gender, birth_date, rgpd } = req.body;

  if (!first_name || !last_name || !rgpd) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }

  try {
    // Vérifie les doublons sur email (si fourni) et sur nom+prénom,
    // même si le client est désactivé, pour empêcher la recréation d'une carte.
    if (email) {
      const existingEmail = await pool.query('SELECT id FROM loyalty_clients WHERE LOWER(email) = LOWER($1)', [email]);
      if (existingEmail.rows.length > 0) {
        return res.status(409).json({ error: 'Cette adresse email est déjà inscrite.' });
      }
    }

    const existingName = await pool.query(
      'SELECT id FROM loyalty_clients WHERE LOWER(first_name) = LOWER($1) AND LOWER(last_name) = LOWER($2)',
      [first_name, last_name]
    );
    if (existingName.rows.length > 0) {
      return res.status(409).json({ error: 'Une carte existe déjà pour ce nom et prénom.' });
    }

    const qrCode = uuidv4();
    // Code court de secours = 4 premiers caractères du qrCode en majuscule
    const shortCode = qrCode.slice(0, 4).toUpperCase();

    const appUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const qrData = `${appUrl}/api/client/${qrCode}`;

    await pool.query(
      `INSERT INTO loyalty_clients 
       (first_name, last_name, phone, email, gender, birth_date, qr_code, short_code, rgpd_accepted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [first_name, last_name, phone || null, email || null, gender || null, birth_date || null, qrCode, shortCode]
    );

    const qrImageUrl = await QRCode.toDataURL(qrData, {
      width: 400,
      margin: 2,
      color: { dark: '#1a1a1a', light: '#ffffff' }
    });

    res.json({ success: true, qrCode, shortCode, qrImageUrl, firstName: first_name });
  } catch (err) {
    console.error(err);
    if (err.code === '23505' && err.constraint && err.constraint.includes('short_code')) {
      // collision rarissime sur le code court, on relance
      return res.status(500).json({ error: 'Réessayez, une erreur technique est survenue.' });
    }
    res.status(500).json({ error: 'Erreur serveur. Réessayez.' });
  }
});

module.exports = router;
