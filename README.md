# Soul Loyalty — Carte Fidélité Premium

Application de carte de fidélité QR code pour SOUL Coffee Shop.

## Stack
- **Node.js + Express** — serveur
- **Supabase** — base de données PostgreSQL
- **Railway** — hébergement

---

## 1. Supabase — Base de données

1. Aller sur [supabase.com](https://supabase.com) → votre projet SOUL existant (ou nouveau)
2. Ouvrir **SQL Editor**
3. Coller le contenu de `init.sql` et cliquer **Run**

Récupérer votre `DATABASE_URL` : Settings → Database → Connection string → URI

---

## 2. SumUp — Clé API

1. Aller sur [me.sumup.com](https://me.sumup.com) → Paramètres → Clés API
2. Créer une clé avec les permissions : `transactions.history`
3. Copier la clé

Votre merchant code : **MF4GFSMN**

---

## 3. GitHub — Dépôt

```bash
git init
git add .
git commit -m "Soul Loyalty v1"
git remote add origin https://github.com/VOTRE_COMPTE/soul-loyalty.git
git push -u origin main
```

---

## 4. Railway — Déploiement

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Sélectionner `soul-loyalty`
3. Aller dans **Variables** et ajouter :

```
DATABASE_URL=postgresql://...  (depuis Supabase)
SESSION_SECRET=une_longue_chaine_aleatoire
CASHIER_PASSWORD=votre_mot_de_passe_caisse
ADMIN_PASSWORD=votre_mot_de_passe_admin
SUMUP_API_KEY=sk_live_...
SUMUP_MERCHANT_CODE=MF4GFSMN
APP_URL=https://VOTRE-APP.railway.app
```

4. Railway détecte automatiquement Node.js et déploie
5. Récupérer l'URL publique et la mettre dans `APP_URL`

---

## 5. QR code d'entrée (pour le coffee shop)

Une fois déployé, créer un QR code pointant vers :
```
https://VOTRE-APP.railway.app/
```

Imprimer et afficher à l'entrée du coffee shop.

---

## URLs de l'application

| Page | URL | Accès |
|------|-----|-------|
| Inscription client | `/` | Public |
| Interface caisse | `/caisse` | Mot de passe caissier |
| Dashboard admin | `/admin` | Mot de passe admin |

---

## Workflow caisse

1. Client présente son QR code sur téléphone
2. Ouvrir `/caisse` sur votre téléphone
3. Scanner le QR code avec la caméra
4. L'app affiche le profil client + transaction SumUp la plus proche
5. Appliquer −10% manuellement dans SumUp
6. Cliquer **Valider la visite**
