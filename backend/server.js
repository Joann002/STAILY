// Importation des modules nécessaires
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Importation des routes
const uploadRouter = require('./routes/upload');
const transcribeRouter = require('./routes/transcribe');

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3002;

// Création du dossier uploads s'il n'existe pas
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Dossier uploads/ créé');
}

// Middlewares
app.use(cors()); // Permet les requêtes cross-origin (utile pour Next.js)
app.use(express.json()); // Parse les requêtes JSON
app.use(express.urlencoded({ extended: true })); // Parse les données de formulaire

// Servir les fichiers statiques (uploads et tmp)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/tmp', express.static(path.join(__dirname, 'tmp')));

// Route de test pour vérifier que le serveur fonctionne
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Serveur Express opérationnel',
    endpoints: {
      upload: 'POST /upload - Upload de fichiers audio/vidéo (.mp4, .mp3, .wav)',
      transcribe: 'POST /transcribe - Extraction audio + transcription Whisper',
      status: 'GET /transcribe/status - Vérifier les prérequis (FFmpeg, Python, Whisper)'
    }
  });
});

// Montage des routes
app.use('/upload', uploadRouter);
app.use('/transcribe', transcribeRouter);

// Middleware de gestion des erreurs
app.use((err, req, res, next) => {
  console.error('❌ Erreur:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Erreur serveur interne'
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📂 Les fichiers seront sauvegardés dans: ${uploadsDir}`);
});
