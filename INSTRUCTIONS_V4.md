# 🔥 CHAT V4 - INSTRUCTIONS DE TEST

## 📥 FICHIERS À TÉLÉCHARGER

✅ `server_v4.js` - Serveur optimisé  
✅ `chat_v4.html` - Client avec esthétique PREMIUM  

---

## 🎯 ÉTAPES DE TEST EN LOCAL

### 1️⃣ **Remplace les fichiers**

Dans ton dossier `Anonym/` :
- `server_v4.js` → renomme en `server.js`
- `chat_v4.html` → renomme en `chat.html` (dans `public/`)

### 2️⃣ **Lance le serveur**

```bash
npm start
```

Tu devrais voir :
```
✅ Serveur prêt sur le port 3000
📡 Support 1000+ utilisateurs
```

### 3️⃣ **Ouvre 2-3 onglets**

Va à : `http://localhost:3000/chat.html`

Ouvre le lien dans **2-3 onglets différents** pour tester.

---

## ✅ LISTE DE TEST (TOUS DOIVENT ÊTRE VERTS)

### **Esthétique & Layout**
- [ ] Sidebar **mIRC** à droite avec liste des users
- [ ] **TOPIC** bar en haut avec bouton "Éditer"
- [ ] QR code et lien de partage à gauche
- [ ] Design **moderne et épuré**

### **Users & Online Status**
- [ ] Compteur users s'affiche en haut
- [ ] Sidebar montre **tous les users connectés**
- [ ] Vert ● = online
- [ ] ➕ notification quand qqn arrive
- [ ] ➖ notification quand qqn part

### **Messages**
- [ ] Messages affichés avec **nom + heure**
- [ ] Tes messages = couleur différente (droit)
- [ ] Messages disparaissent après ~1 sec (en test avec TTL=1)
- [ ] **Ghost messages** restent (nom + heure + réactions)

### **Réactions (IMPORTANT)**
- [ ] Clique sur 👍 👎 😂 sous un message
- [ ] Compteur augmente
- [ ] **Hover sur la réaction** = POPUP avec les noms des users
- [ ] Réactions **restent** même après disparition du message

### **Typing Indicator**
- [ ] Commence à écrire dans un onglet
- [ ] Autres onglets voient "user-xxx est en train d'écrire..."

### **Topic**
- [ ] Clique bouton "Éditer"
- [ ] Modal s'ouvre
- [ ] Tape un nouveau sujet (max 200 chars)
- [ ] Clique "Sauvegarder"
- [ ] **Tous les onglets voient le nouveau sujet** ✅

### **BIP Sonore**
- [ ] Tu entends un BIP quand tu reçois un message
- [ ] Tu entends un BIP pour les notifications

### **Thème**
- [ ] Clique ⚙️ en haut
- [ ] **Mode sombre** checkbox
- [ ] **Color picker** change la couleur du thème
- [ ] Input hex pour entrer une couleur exacte
- [ ] Les changements **persistent** (localStorage)

### **QR & Copy**
- [ ] QR code s'affiche et est scannable
- [ ] Clique "Copier" → "✓ Copié !" feedback
- [ ] URL complète est copiée

### **Performance**
- [ ] Pas de lag même avec 2-3 onglets
- [ ] Chat scroll smooth
- [ ] Réactions instant

---

## 🐛 SI UN TEST ÉCHOUE

**Copie/colle :**
1. Le numéro du test qui échoue
2. Ce que tu vois
3. Erreurs dans la console (F12 → Console)

**Exemple :**
```
Test échoué: Hover sur réaction
Vu: Rien ne s'affiche au hover
Console: Aucune erreur
```

---

## 📤 UNE FOIS QUE TOUT MARCHE

```bash
git add .
git commit -m "v4: Premium design - sidebar users, topic, reaction popups"
git push
```

**Render va redéployer en ~2 min ! 🚀**

---

## 🎨 FEATURES V4

✅ **Sidebar mIRC** - Liste users en temps réel  
✅ **TOPIC** - Changeable par tous  
✅ **Reaction Popups** - Hover pour voir qui a réagi  
✅ **Esthétique Premium** - Moderne + Professionnel  
✅ **Ghost Messages** - Réactions persistent  
✅ **Thème Personnalisé** - Color picker + Mode sombre  
✅ **1000+ Users** - Optimisé performance  

---

**BON TEST ! 🚀**
