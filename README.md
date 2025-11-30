# 🚀 Serveur Express - Upload de Fichiers Audio/Vidéo

Serveur backend simple pour l'upload de fichiers audio et vidéo (.mp4, .mp3, .wav).

## 📋 Prérequis

- Node.js v20 ou supérieur
- npm (inclus avec Node.js)

## 🔧 Installation

1. **Naviguer dans le dossier backend** :
```bash
cd backend
```

2. **Installer les dépendances** :
```bash
npm install
```

Cela installera :
- `express` : Framework web pour Node.js
- `multer` : Middleware pour gérer l'upload de fichiers
- `cors` : Permet les requêtes cross-origin
- `nodemon` : Redémarre automatiquement le serveur en développement

## 🚀 Démarrage

### Mode développement (avec auto-reload)
```bash
npm run dev
```

### Mode production
```bash
npm start
```

Le serveur démarre sur **http://localhost:3001**

## 📡 API Endpoints

### 1. Test du serveur
```
GET http://localhost:3001/
```
Vérifie que le serveur fonctionne.

### 2. Upload de fichier
```
POST http://localhost:3001/upload
```

**Paramètres** :
- `file` : Le fichier à uploader (champ multipart/form-data)

**Formats acceptés** :
- `.mp4` (vidéo)
- `.mp3` (audio)
- `.wav` (audio)

**Taille maximale** : 100 MB

**Exemple de réponse** :
```json
{
  "success": true,
  "message": "Fichier uploadé avec succès",
  "file": {
    "originalName": "audio.mp3",
    "savedName": "audio-1234567890-123456789.mp3",
    "path": "/chemin/vers/backend/uploads/audio-1234567890-123456789.mp3",
    "relativePath": "/uploads/audio-1234567890-123456789.mp3",
    "size": 5242880,
    "sizeInMB": "5.00",
    "mimetype": "audio/mpeg",
    "uploadedAt": "2025-11-29T10:30:00.000Z"
  }
}
```

### 3. Lister les fichiers uploadés
```
GET http://localhost:3001/upload/files
```

## 🧪 Tester avec curl

```bash
# Upload d'un fichier
curl -X POST http://localhost:3001/upload \
  -F "file=@/chemin/vers/votre/fichier.mp3"

# Lister les fichiers
curl http://localhost:3001/upload/files
```

## 📁 Structure du projet

```
backend/
├── node_modules/       # Dépendances (créé après npm install)
├── uploads/            # Fichiers uploadés (créé automatiquement)
├── routes/
│   └── upload.js       # Logique d'upload avec Multer
├── server.js           # Point d'entrée du serveur
├── package.json        # Configuration et dépendances
├── .gitignore          # Fichiers à ignorer par Git
└── README.md           # Ce fichier
```

## 🔒 Sécurité

- Validation des extensions de fichiers (.mp4, .mp3, .wav)
- Validation des types MIME
- Limite de taille de fichier (100 MB)
- Noms de fichiers uniques pour éviter les écrasements

## 🛠️ Développement

Le serveur utilise `nodemon` en mode développement, ce qui signifie qu'il redémarre automatiquement à chaque modification du code.

## 📝 Notes

- Les fichiers sont sauvegardés dans `backend/uploads/`
- Chaque fichier reçoit un nom unique avec timestamp
- Le dossier `uploads/` est créé automatiquement au démarrage
- CORS est activé pour permettre les requêtes depuis Next.js
