// Importation des modules nécessaires
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Importation des routes
const uploadRouter = require('./routes/upload');
const transcribeRouter = require('./routes/transcribe');
const transcribeCompleteRouter = require('./routes/transcribe-complete');
const transcribeRobustRouter = require('./routes/transcribe-robust');
const applyVerbatimRouter = require('./routes/apply-verbatim');

// Initialisation de l'application Express
const app = express();
const PORT = process.env.PORT || 3002;

// Création des dossiers nécessaires s'ils n'existent pas
const uploadsDir = path.join(__dirname, 'uploads');
const cacheDir = path.join(__dirname, 'cache');
const gptCacheDir = path.join(__dirname, 'cache', 'gpt');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Dossier uploads/ créé');
}

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log('📁 Dossier cache/ créé');
}

if (!fs.existsSync(gptCacheDir)) {
  fs.mkdirSync(gptCacheDir, { recursive: true });
  console.log('📁 Dossier cache/gpt/ créé');
}

// Middlewares
app.use(cors()); // Permet les requêtes cross-origin (utile pour Next.js)
app.use(express.json({ limit: '500mb' })); // Parse les requêtes JSON avec limite augmentée
app.use(express.urlencoded({ extended: true, limit: '500mb' })); // Parse les données de formulaire

// Servir les fichiers statiques (uploads et tmp)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/tmp', express.static(path.join(__dirname, 'tmp')));

// Route de test pour vérifier que le serveur fonctionne
app.get('/', (req, res) => {
  res.json({
    message: '🚀 Serveur Express opérationnel',
    endpoints: {
      upload: 'POST /upload - Upload de fichiers audio/vidéo (.mp4, .mkv, .mp3, .wav)',
      transcribe: 'POST /transcribe - Extraction audio + transcription Whisper',
      transcribeComplete: 'POST /transcribe-complete - Pipeline complet avec cache intelligent (Whisper + Nettoyage + GPT + SRT)',
      transcribeRobust: 'POST /transcribe-robust - Pipeline ROBUSTE avec gestion automatique de qualité audio (Analyse + Amélioration + Fallbacks + GPT)',
      applyRules: 'POST /apply-rules - Application des règles de Verbatim Corrigé avec GPT-4o-mini',
      gptCacheStats: 'GET /gpt-cache/stats - Statistiques du cache GPT',
      gptCacheList: 'GET /gpt-cache/list - Liste des caches GPT',
      gptCacheDelete: 'DELETE /gpt-cache/:hash - Supprimer un cache GPT',
      gptCacheClean: 'POST /gpt-cache/clean - Nettoyer les caches GPT anciens',
      status: 'GET /transcribe/status - Vérifier les prérequis (FFmpeg, Python, Whisper)',
      cacheInspect: 'CLI: node backend/utils/inspectCache.js - Gérer le cache'
    }
  });
});

// Montage des routes
app.use('/upload', uploadRouter);
app.use('/transcribe', transcribeRouter);
app.use('/transcribe-complete', transcribeCompleteRouter);
app.use('/transcribe-robust', transcribeRobustRouter);
app.use('/apply-verbatim', applyVerbatimRouter);

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
  console.log(`📂 Uploads: ${uploadsDir}`);
  console.log(`💾 Cache: ${cacheDir}`);
});
