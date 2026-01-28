# 🚀 DÉPLOIEMENT SUR RAILWAY - GUIDE COMPLET

## ✅ Prérequis
- ✔️ Un compte GitHub (gratuit)
- ✔️ Un compte Railway (gratuit) - https://railway.app
- ✔️ Ton projet Node.js (server.js + package.json)

---

## 📋 ÉTAPE 1 : Préparer ton projet sur GitHub

### 1.1 Crée un dépôt GitHub
1. Va sur https://github.com/new
2. Nomme-le `anonym-chat` (ou ce que tu veux)
3. **Public** ou **Private** (au choix)
4. Clique "Create repository"

### 1.2 Pousse ton code sur GitHub
```bash
# Dans le dossier de ton projet
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/anonym-chat.git
git push -u origin main
```

⚠️ **Remplace `TON_USERNAME` par ton username GitHub**

Si tu n'as pas Git installé, télécharge depuis https://git-scm.com

---

## 🚂 ÉTAPE 2 : Connecter Railway à GitHub

### 2.1 Va sur https://railway.app
1. Clique **Sign Up** (ou Sign In si tu as un compte)
2. Choisis **"Continue with GitHub"**
3. Autorise Railway à accéder à tes repos
4. ✅ Tu es connecté

### 2.2 Crée un nouveau projet
1. Clique **"+ New Project"** (en haut à droite)
2. Sélectionne **"Deploy from GitHub"**
3. Cherche ton repo `anonym-chat`
4. Clique **"Deploy Now"**

---

## ⚙️ ÉTAPE 3 : Configuration automatique (Railway fait presque tout)

Railway détecte automatiquement :
- ✅ Node.js (grâce à `package.json`)
- ✅ La commande `npm start` (du script dans `package.json`)
- ✅ Le port (grâce à `process.env.PORT`)

**Tu n'as rien à faire, Railway lance ton serveur tout seul.**

---

## 🔗 ÉTAPE 4 : Récupérer ton URL stable

### 4.1 Attends ~2-3 minutes (première build)
Railway va :
1. Cloner ton repo
2. Installer les dépendances (`npm install`)
3. Lancer le serveur (`npm start`)
4. Générer une URL publique

### 4.2 Trouve ton URL
1. Dans le dashboard Railway, clique sur ton **projet**
2. Clique sur le service **"anonym-chat"** (ou le nom que tu as donné)
3. Onglet **"Settings"** → cherche **"Domains"**
4. Tu verras quelque chose comme : `anonym-chat-production-xyz.up.railway.app`

✅ **C'est ton URL stable !**

---

## 🌐 ÉTAPE 5 : Utiliser ton URL dans le client

Si tu as un fichier HTML/JS côté client, remplace l'URL du WebSocket :

### Avant (local) :
```javascript
const ws = new WebSocket("ws://localhost:3000/ws");
```

### Après (Railway) :
```javascript
const ws = new WebSocket("wss://anonym-chat-production-xyz.up.railway.app/ws");
```

⚠️ **Important :** Utilise `wss://` (WebSocket Secure) sur Railway, pas `ws://`

---

## 🎁 BONUS : Ajouter un domaine personnalisé

Si tu veux une URL plus sympa genre `anonym-chat.fr` :

1. Achète un domaine (Namecheap, OVH, etc.) - ~$10/an
2. Dans Railway → Settings → **Custom Domain**
3. Ajoute ton domaine
4. Railway te donne un **CNAME** à mettre chez ton registrar
5. Attends ~10 min la propagation DNS
6. Boom, tu peux utiliser `https://anonym-chat.fr/`

---

## 🆓 Plan gratuit Railway

- **500 heures/mois** (24/7 = ~730h, donc suffisant si tu deux serveurs ou <24h)
- **5$ de crédit gratuit/mois** (bonne marge)
- Arrêt auto après inactivité (optionnel)

**Pour garder le serveur toujours actif :**
1. Settings → **"Environments"** → Production
2. Désactive "Sleeping" si ça pose problème

---

## 🐛 Troubleshooting

### ❌ "WebSocket failed to connect"
**Raison :** Tu utilises `ws://` au lieu de `wss://`  
**Solution :** Utilise `wss://` (WebSocket Secure)

### ❌ "Connection refused / 502"
**Raison :** Le serveur n'a pas démarré ou pas prêt  
**Solution :** 
1. Clique sur le log dans Railway
2. Cherche les erreurs
3. Vérifie que `package.json` a `"start": "node server.js"`

### ❌ "Cannot find module 'express'"
**Raison :** Dependencies pas installées  
**Solution :** Ajoute un fichier `.gitignore` et *exclue* `node_modules` (Railway réinstalle tout)

```
# .gitignore
node_modules/
.env
```

---

## 📊 Vérifier le statut

- Dashboard Railway → Ton projet → Onglet "Deployments"
- Tu vois l'historique des déploiements
- En vert = ✅ Prêt
- En orange = ⏳ En cours
- En rouge = ❌ Erreur

---

## ✨ C'EST PRÊT !

Après ces étapes, tu as :
✅ URL stable (genre `anonym-chat-xyz.up.railway.app`)  
✅ HTTPS automatique (wss://)  
✅ Serveur 24/7 (tant que tu as du crédit)  
✅ Zéro configuration DNS  
✅ Deploy automatique si tu push sur GitHub  

Des questions ? Demande ! 🚀
