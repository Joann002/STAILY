/**
 * Route pour appliquer les règles de verbatim corrigé avec GPT-4o-mini
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { applyVerbatimRules, generateCorrectedText, generateCorrectedSRT } = require('../services/rulesEngine');

const router = express.Router();

// Charger les variables d'environnement
require('dotenv').config();

/**
 * POST /apply-rules
 * Applique les règles de verbatim corrigé sur une transcription
 * 
 * Body JSON:
 * {
 *   "segments": [...],           // Segments de transcription brute
 *   "language": "fr",             // optionnel: fr, en
 *   "context": "Entrevue formelle", // optionnel: contexte additionnel
 *   "saveSRT": true               // optionnel: sauvegarder le fichier .srt
 * }
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      segments,
      language = 'fr',
      context = '',
      saveSRT = true
    } = req.body;
    
    console.log('\n🎯 === APPLICATION DES RÈGLES DE VERBATIM CORRIGÉ ===');
    console.log(`📝 Segments: ${segments?.length || 0}`);
    console.log(`🌍 Langue: ${language}`);
    console.log(`📋 Contexte: ${context || 'Aucun'}`);
    
    // Validation
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Le paramètre "segments" est requis et doit être un tableau non vide'
      });
    }
    
    // Vérifier la clé API OpenAI
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'OPENAI_API_KEY non configurée sur le serveur'
      });
    }
    
    // Appliquer les règles avec GPT-4o-mini
    console.log('\n📍 Application des règles avec GPT-4o-mini...');
    const result = await applyVerbatimRules(segments, {
      openaiApiKey: apiKey,
      language,
      context
    });
    
    // Générer le texte complet corrigé
    const correctedText = generateCorrectedText(result.correctedSegments);
    console.log(`✅ Texte corrigé généré: ${correctedText.length} caractères`);
    
    // Générer le fichier SRT si demandé
    let srtPath = null;
    let srtContent = null;
    
    if (saveSRT) {
      srtContent = generateCorrectedSRT(result.correctedSegments);
      
      // Sauvegarder dans tmp/
      const tmpDir = path.join(__dirname, '..', 'tmp');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      const timestamp = Date.now();
      srtPath = path.join(tmpDir, `corrected_${timestamp}.srt`);
      fs.writeFileSync(srtPath, srtContent);
      
      console.log(`💾 Fichier SRT sauvegardé: ${srtPath}`);
    }
    
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ === RÈGLES APPLIQUÉES EN ${totalTime}s ===\n`);
    
    // Préparer la réponse
    const response = {
      success: true,
      message: 'Règles de verbatim corrigé appliquées avec succès',
      corrected: {
        text: correctedText,
        segments: result.correctedSegments,
        srtContent: srtContent,
        srtPath: srtPath ? path.relative(path.join(__dirname, '..'), srtPath) : null
      },
      summary: result.summary,
      statistics: result.statistics,
      metadata: result.metadata,
      performance: {
        totalTimeSeconds: totalTime,
        segmentCount: result.correctedSegments.length
      }
    };
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('\n❌ === ERREUR APPLICATION RÈGLES ===');
    console.error(error);
    console.error('=====================================\n');
    
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'application des règles',
      details: error.message
    });
  }
});

module.exports = router;
