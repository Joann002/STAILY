// Importation des modules nécessaires
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractAudio } = require('../scripts/extractAudio');

// Création du routeur Express
const router = express.Router();

// Configuration du stockage avec Multer
const storage = multer.diskStorage({
  // Définir le dossier de destination
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    cb(null, uploadPath);
  },
  
  // Définir le nom du fichier sauvegardé
  filename: (req, file, cb) => {
    // Génère un nom unique : timestamp + nom original (sans caractères spéciaux)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const nameWithoutExt = path.basename(file.originalname, ext);
    
    // Nettoyer le nom : remplacer les caractères spéciaux et espaces
    const cleanName = nameWithoutExt
      .normalize('NFD')                    // Décomposer les accents
      .replace(/[\u0300-\u036f]/g, '')     // Supprimer les accents
      .replace(/[^a-zA-Z0-9-_]/g, '_')     // Remplacer caractères spéciaux par _
      .replace(/_+/g, '_')                 // Remplacer multiples _ par un seul
      .substring(0, 50);                   // Limiter la longueur
    
    cb(null, `${cleanName}-${uniqueSuffix}${ext}`);
  }
});

// Fonction de validation des types de fichiers
const fileFilter = (req, file, cb) => {
  // Extensions autorisées
  const allowedExtensions = ['.mp4', '.mp3', '.wav'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Types MIME autorisés
  const allowedMimeTypes = [
    'audio/mpeg',      // .mp3
    'audio/wav',       // .wav
    'audio/wave',      // .wav (alternative)
    'audio/x-wav',     // .wav (alternative)
    'video/mp4'        // .mp4
  ];
  
  // Vérification de l'extension ET du type MIME
  if (allowedExtensions.includes(ext) && allowedMimeTypes.includes(file.mimetype)) {
    console.log(`✅ Fichier accepté: ${file.originalname} (${file.mimetype})`);
    cb(null, true);
  } else {
    console.log(`❌ Fichier rejeté: ${file.originalname} (${file.mimetype})`);
    cb(new Error(`Type de fichier non autorisé. Formats acceptés: ${allowedExtensions.join(', ')}`), false);
  }
};

// Configuration de Multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // Limite de 100 MB
  }
});

// Route POST /upload
// Accepte un seul fichier avec le champ "file"
router.post('/', upload.single('file'), async (req, res) => {
  try {
    // Vérifier si un fichier a été uploadé
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Aucun fichier fourni'
      });
    }
    
    console.log(`📤 Fichier uploadé: ${req.file.originalname} → ${req.file.filename}`);
    
    // Informations sur le fichier uploadé
    const fileInfo = {
      success: true,
      message: 'Fichier uploadé avec succès',
      file: {
        originalName: req.file.originalname,
        savedName: req.file.filename,
        path: req.file.path,
        relativePath: `/uploads/${req.file.filename}`,
        size: req.file.size,
        sizeInMB: (req.file.size / (1024 * 1024)).toFixed(2),
        mimetype: req.file.mimetype,
        uploadedAt: new Date().toISOString()
      }
    };
    
    // Si c'est un fichier vidéo (.mp4), extraire l'audio automatiquement
    if (req.file.mimetype === 'video/mp4') {
      try {
        console.log('🎬 Extraction audio en cours...');
        const audioPath = await extractAudio(req.file.path);
        
        fileInfo.audio = {
          path: audioPath,
          relativePath: `/tmp/${path.basename(audioPath)}`,
          format: 'WAV mono 16kHz'
        };
        fileInfo.message = 'Fichier uploadé et audio extrait avec succès';
        
        console.log(`✅ Audio extrait: ${audioPath}`);
      } catch (audioError) {
        console.error('⚠️ Erreur extraction audio:', audioError.message);
        fileInfo.audioError = audioError.message;
        fileInfo.message = 'Fichier uploadé mais échec extraction audio';
      }
    }
    
    // Réponse JSON avec les informations du fichier
    res.status(200).json(fileInfo);
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'upload:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'upload du fichier'
    });
  }
});

// Route GET pour lister les fichiers uploadés (optionnel, utile pour le debug)
router.get('/files', (req, res) => {
  const uploadsPath = path.join(__dirname, '../uploads');
  
  fs.readdir(uploadsPath, (err, files) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: 'Impossible de lire le dossier uploads'
      });
    }
    
    res.json({
      success: true,
      count: files.length,
      files: files
    });
  });
});

// Export du routeur
module.exports = router;
