/**
 * Service de formatage de transcription via GPT-4o-mini
 * Prend des segments nettoyés et retourne un SRT structuré + résumé
 */

const fs = require('fs');
const path = require('path');

/**
 * Charge le template de prompt
 * @returns {Object} {system, user}
 */
function loadPromptTemplate() {
  const promptPath = path.join(__dirname, '../prompts/transcription-prompt.json');
  const promptData = fs.readFileSync(promptPath, 'utf8');
  return JSON.parse(promptData);
}

/**
 * Convertit les secondes en format SRT (HH:MM:SS,mmm)
 * @param {number} seconds - Temps en secondes
 * @returns {string} Format SRT
 */
function secondsToSRT(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Formate les segments pour le prompt
 * @param {Array<Object>} segments - Segments nettoyés
 * @returns {string} Segments formatés pour le prompt
 */
function formatSegmentsForPrompt(segments) {
  return JSON.stringify(segments.map(s => ({
    start: s.start,
    end: s.end,
    text: s.text
  })), null, 2);
}

/**
 * Appelle l'API OpenAI GPT-4o-mini
 * @param {Array<Object>} segments - Segments de transcription nettoyés
 * @param {string} apiKey - Clé API OpenAI
 * @returns {Promise<Object>} {srt, summary}
 */
async function formatWithGPT(segments, apiKey) {
  const prompt = loadPromptTemplate();
  const segmentsText = formatSegmentsForPrompt(segments);
  const userPrompt = prompt.user.replace('{{SEGMENTS}}', segmentsText);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  return JSON.parse(content);
}

/**
 * Convertit le format JSON en fichier SRT
 * @param {Array<Object>} srtData - Données SRT [{index, start, end, text}]
 * @returns {string} Contenu du fichier SRT
 */
function generateSRTFile(srtData) {
  return srtData.map(entry => {
    return `${entry.index}\n${entry.start} --> ${entry.end}\n${entry.text}\n`;
  }).join('\n');
}

module.exports = {
  loadPromptTemplate,
  secondsToSRT,
  formatSegmentsForPrompt,
  formatWithGPT,
  generateSRTFile
};
