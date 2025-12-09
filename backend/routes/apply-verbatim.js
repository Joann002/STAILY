/**
 * Route pour appliquer les règles de verbatim corrigé
 * Utilise GPT-4o-mini avec les règles prédéfinies
 */

const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');
const { VERBATIM_RULES } = require('../config/verbatimRules');

/**
 * POST /apply-verbatim
 * Applique les règles de verbatim corrigé à une transcription
 * 
 * Body attendu:
 * {
 *   "segments": [
 *     { "id": 1, "start": 0, "end": 5, "text": "Hum, j'ai pas..." },
 *     ...
 *   ]
 * }
 */
router.post('/', async (req, res) => {
  const { segments } = req.body;

  // Validation
  if (!segments || !Array.isArray(segments) || segments.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Le champ "segments" est requis et doit être un tableau non vide'
    });
  }

  console.log('🤖 Application des règles de verbatim corrigé...');
  console.log(`📝 ${segments.length} segments à traiter`);

  // Préparer le texte complet (une ligne par segment)
  const fullText = segments.map(seg => seg.text).join('\n');

  // Construire les arguments pour le script Python
  const scriptPath = path.join(__dirname, '../scripts/ai.py');
  const args = [
    scriptPath,
    fullText,
    '--system', VERBATIM_RULES,
    '--temperature', '0.3', // Basse température pour précision
    '--max-tokens', '4000'
  ];

  // Exécuter le script Python
  const pythonProcess = spawn('python3', args, {
    env: { ...process.env }
  });

  let stdout = '';
  let stderr = '';

  pythonProcess.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  pythonProcess.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  pythonProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Erreur Python:', stderr);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de l\'exécution du script Python',
        details: stderr
      });
    }

    try {
      const result = JSON.parse(stdout);
      
      if (!result.success) {
        console.error('❌ Erreur GPT:', result.error);
        return res.status(500).json(result);
      }

      // Diviser la réponse en lignes
      const correctedLines = result.response.split('\n').filter(line => line.trim());
      
      // Créer les segments BRUTS (version originale complète)
      const rawSegments = segments.map(seg => ({
        id: seg.id,
        start: seg.start,
        end: seg.end,
        text: seg.text
      }));
      
      // Créer les segments CORRIGÉS (version GPT)
      const correctedSegments = segments.map((seg, index) => {
        const correctedText = (correctedLines[index] || seg.text).trim();
        
        return {
          id: seg.id,
          start: seg.start,
          end: seg.end,
          text: correctedText
        };
      });

      // Calculer les statistiques
      const modified = correctedSegments.filter((seg, index) => 
        seg.text !== rawSegments[index].text
      ).length;
      
      console.log('✅ Règles appliquées avec succès');
      console.log(`📊 ${modified}/${segments.length} segments modifiés`);
      console.log(`📊 Tokens utilisés: ${result.usage.total_tokens}`);
      
      res.json({
        success: true,
        raw: {
          segments: rawSegments,
          fullText: rawSegments.map(s => s.text).join('\n')
        },
        corrected: {
          segments: correctedSegments,
          fullText: correctedSegments.map(s => s.text).join('\n')
        },
        statistics: {
          totalSegments: segments.length,
          segmentsModified: modified,
          tokensUsed: result.usage.total_tokens
        },
        model: result.model
      });
    } catch (error) {
      console.error('❌ Erreur parsing JSON:', error.message);
      console.error('Stdout:', stdout);
      res.status(500).json({
        success: false,
        error: 'Erreur lors du parsing de la réponse',
        details: error.message
      });
    }
  });

  pythonProcess.on('error', (error) => {
    console.error('❌ Erreur spawn:', error.message);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du lancement du script Python',
      details: error.message
    });
  });
});

module.exports = router;
