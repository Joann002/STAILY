'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { XCircle, ArrowLeft, FileText, Copy, Download, Brain, CheckCircle, Sparkles, BarChart3, Clock, Hash, Type, Languages, ClipboardCheck } from 'lucide-react';

// Configuration de l'API backend
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';


interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface CorrectedSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export default function TextView() {
  const router = useRouter();
  const [segments, setSegments] = useState<Segment[]>([]);
  const [metadata, setMetadata] = useState<any>(null);
  const [correctedSegments, setCorrectedSegments] = useState<CorrectedSegment[] | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showCorrected, setShowCorrected] = useState(false);
  const [correctionSummary, setCorrectionSummary] = useState<string>('');
  const [correctionStats, setCorrectionStats] = useState<any>(null);
  const [notification, setNotification] = useState<{ message: React.ReactNode; type: 'success' | 'error' } | null>(null);
  const [isApplyingRules, setIsApplyingRules] = useState(false);

  useEffect(() => {
    // Récupérer les données depuis sessionStorage
    const transcriptionData = sessionStorage.getItem('transcription');
    const metadataData = sessionStorage.getItem('transcriptionMetadata');
    const correctedData = sessionStorage.getItem('correctedTranscription');
    
    if (transcriptionData) {
      const data = JSON.parse(transcriptionData);
      setSegments(data.raw?.segments || []);
    }
    
    if (metadataData) {
      setMetadata(JSON.parse(metadataData));
    }
    
    // Charger les corrections GPT si elles existent déjà
    if (correctedData) {
      const corrected = JSON.parse(correctedData);
      setCorrectedSegments(corrected.segments);
      setCorrectionSummary(corrected.summary);
      setCorrectionStats(corrected.statistics);
      setShowCorrected(true);
    }
  }, []);
  
  // Auto-hide notification après 5 secondes
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleBack = () => {
    // Retourner à la page principale avec l'état de transcription
    router.push('/');
  };

  const handleApplyRules = async () => {
    setIsApplyingRules(true);
    setNotification({
      message: <><Brain className="inline-block w-4 h-4 mr-2" /> Application des règles de verbatim corrigé en cours...</>,
      type: 'success'
    });

    try {
      // Appeler la route backend dédiée
      const response = await fetch(`${API_BASE_URL}/apply-verbatim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          segments: segments
        }),
      });

      const data = await response.json();
      console.log('📥 Réponse API:', data);

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erreur lors de la correction');
      }

      if (data.corrected && data.corrected.segments) {
        setCorrectedSegments(data.corrected.segments);
        setShowCorrected(true);
        setCorrectionSummary(`${data.statistics.segmentsModified} segments corrigés sur ${data.statistics.totalSegments}`);
        setCorrectionStats(data.statistics);
        
        // Sauvegarder dans sessionStorage
        sessionStorage.setItem('correctedTranscription', JSON.stringify({
          segments: data.corrected.segments,
          summary: `${data.statistics.segmentsModified} segments corrigés sur ${data.statistics.totalSegments}`,
          statistics: data.statistics,
        }));

        setNotification({
          message: <><CheckCircle className="inline-block w-4 h-4 mr-2" /> Règles de verbatim corrigé appliquées avec succès !</>,
          type: 'success'
        });
      } else {
        console.error('Structure de réponse inattendue:', data);
        throw new Error('Structure de réponse invalide');
      }
    } catch (error) {
      console.error('Erreur lors de l\'application des règles:', error);
      setNotification({
        message: <><XCircle className="inline-block w-4 h-4 mr-2" /> Erreur: {error instanceof Error ? error.message : 'Erreur inconnue'}</>,
        type: 'error'
      });
    } finally {
      setIsApplyingRules(false);
    }
  };

  const handleCopyText = () => {
    const textToUse = correctedSegments 
      ? correctedSegments.map(seg => seg.text).join('\n')
      : segments.map(seg => seg.text).join('\n');
    
    navigator.clipboard.writeText(textToUse);
    setNotification({ message: <><ClipboardCheck className="inline-block w-4 h-4 mr-2" /> Texte copié dans le presse-papier !</>, type: 'success' });
  };

  const handleDownloadText = () => {
    const textToUse = correctedSegments 
      ? correctedSegments.map(seg => seg.text).join('\n')
      : segments.map(seg => seg.text).join('\n');
    
    const blob = new Blob([textToUse], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcription-${correctedSegments ? 'corrigee' : 'brute'}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (segments.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            <XCircle className="inline-block w-6 h-6 mr-2" /> Aucune transcription disponible
          </h1>
          <button
            onClick={handleBack}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg"
          >
            ← Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className={`flex items-center space-x-3 px-6 py-4 rounded-lg shadow-lg ${
            notification.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            <span className="text-lg">
              {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            </span>
            <span className="font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-4 text-white hover:text-gray-200 transition-colors"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        {/* Header avec navigation */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handleBack}
              className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Retour</span>
            </button>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {correctedSegments ? <><BarChart3 className="inline-block w-6 h-6 mr-2" /> Comparaison Brut vs Corrigé</> : <><FileText className="inline-block w-6 h-6 mr-2" /> Texte brut</>}
            </h1>

            <div className="flex space-x-2">
              <button
                onClick={handleCopyText}
                className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg transition-colors"
                title="Copier le texte"
              >
                <Copy className="w-5 h-5" />
                <span className="hidden sm:inline">Copier</span>
              </button>

              <button
                onClick={handleDownloadText}
                className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                title="Télécharger le texte"
              >
                <Download className="w-5 h-5" />
                <span className="hidden sm:inline">Télécharger</span>
              </button>
            </div>
          </div>

          {/* Métadonnées */}
          {metadata && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">Langue</p>
                <p className="text-lg font-bold text-green-800 dark:text-green-200">
                  {metadata.language?.toUpperCase() || 'N/A'}
                </p>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Durée</p>
                <p className="text-lg font-bold text-blue-800 dark:text-blue-200">
                  {metadata.duration?.toFixed(1) || 0}s
                </p>
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Lignes</p>
                <p className="text-lg font-bold text-purple-800 dark:text-purple-200">
                  {segments.length}
                </p>
              </div>
            </div>
          )}

          {/* Bouton pour appliquer les règles GPT */}
          {!correctedSegments && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-2 border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-1">
                    <Brain className="inline-block w-5 h-5 mr-2" /> Verbatim Corrigé avec GPT-4o-mini
                  </h3>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    Appliquer les règles professionnelles : suppression hésitations, correction grammaire, ponctuation optimale
                  </p>
                </div>
                <button
                  onClick={handleApplyRules}
                  disabled={isApplyingRules}
                  className="ml-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition-all transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed shadow-lg"
                >
                  {isApplyingRules ? (
                    <span className="flex items-center space-x-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Traitement...</span>
                    </span>
                  ) : (
                    <><Sparkles className="inline-block w-5 h-5 mr-2" /> Appliquer les règles CV</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Statistiques de correction */}
          {correctedSegments && (
            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-1">
                <CheckCircle className="inline-block w-5 h-5 mr-2" /> Règles appliquées avec succès !
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300 mb-2">
                {correctionSummary}
              </p>
              {correctionStats && (
                <div className="flex space-x-4 text-xs text-green-600 dark:text-green-400">
                  <span><Type className="inline-block w-3 h-3 mr-1" /> {correctionStats.segmentsModified}/{correctionStats.totalSegments} segments modifiés</span>
                  <span><Hash className="inline-block w-3 h-3 mr-1" /> {correctionStats.tokensUsed} tokens utilisés</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Texte complet - Affichage côte à côte si corrigé disponible */}
        {!correctedSegments ? (
          // Vue simple : texte brut uniquement
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-6">
              <FileText className="inline-block w-5 h-5 mr-2" /> Transcription brute
            </h2>
            <div className="prose dark:prose-invert max-w-none">
              <div className="space-y-4 text-gray-800 dark:text-gray-200 leading-relaxed">
                {segments.map((segment) => (
                  <p key={segment.id} className="text-base">
                    {segment.text}
                  </p>
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                <span>
                  <BarChart3 className="inline-block w-4 h-4 mr-1" /> {segments.length} lignes • {segments.map(s => s.text).join(' ').split(' ').length} mots
                </span>
                <span>
                  <Type className="inline-block w-4 h-4 mr-1" /> {segments.map(s => s.text).join('').length} caractères
                </span>
              </div>
            </div>
          </div>
        ) : (
          // Vue côte à côte : brut vs corrigé
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* COLONNE GAUCHE : Texte BRUT */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  <FileText className="inline-block w-5 h-5 mr-2" /> Version brute
                </h2>
                <button
                  onClick={() => {
                    const text = segments.map(seg => seg.text).join('\n');
                    navigator.clipboard.writeText(text);
                    setNotification({ message: <><ClipboardCheck className="inline-block w-4 h-4 mr-2" /> Texte brut copié !</>, type: 'success' });
                  }}
                  className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                  title="Copier le texte brut"
                >
                  <Copy className="inline-block w-4 h-4 mr-1" /> Copier
                </button>
              </div>
              
              <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
                {segments.map((segment) => (
                  <div key={segment.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 border-l-4 border-gray-400">
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                      {segment.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* Stats brut */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                  <p><BarChart3 className="inline-block w-3 h-3 mr-1" /> {segments.length} segments</p>
                  <p><Type className="inline-block w-3 h-3 mr-1" /> {segments.map(s => s.text).join(' ').split(' ').length} mots</p>
                  <p><Hash className="inline-block w-3 h-3 mr-1" /> {segments.map(s => s.text).join('').length} caractères</p>
                </div>
              </div>
            </div>

            {/* COLONNE DROITE : Texte CORRIGÉ */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-green-800 dark:text-green-200">
                  <Sparkles className="inline-block w-5 h-5 mr-2" /> Version corrigée
                </h2>
                <button
                  onClick={() => {
                    const text = correctedSegments.map(seg => seg.text).join('\n');
                    navigator.clipboard.writeText(text);
                    setNotification({ message: <><ClipboardCheck className="inline-block w-4 h-4 mr-2" /> Texte corrigé copié !</>, type: 'success' });
                  }}
                  className="text-sm text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                  title="Copier le texte corrigé"
                >
                  <Copy className="inline-block w-4 h-4 mr-1" /> Copier
                </button>
              </div>
              
              <div className="space-y-3 max-h-[800px] overflow-y-auto pr-2">
                {correctedSegments.map((segment) => (
                  <div key={segment.id} className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border-l-4 border-green-500">
                    <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
                      {segment.text}
                    </p>
                  </div>
                ))}
              </div>

              {/* Stats corrigé */}
              <div className="mt-4 pt-4 border-t border-green-200 dark:border-green-800">
                <div className="text-xs text-green-600 dark:text-green-400 space-y-1">
                  <p><BarChart3 className="inline-block w-3 h-3 mr-1" /> {correctedSegments.length} segments</p>
                  <p><Type className="inline-block w-3 h-3 mr-1" /> {correctedSegments.map(s => s.text).join(' ').split(' ').length} mots</p>
                  <p><Hash className="inline-block w-3 h-3 mr-1" /> {correctedSegments.map(s => s.text).join('').length} caractères</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bouton retour en bas */}
        <div className="mt-6 text-center">
          <button
            onClick={handleBack}
            className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            ← Retour à la transcription
          </button>
        </div>
      </div>
    </div>
  );
}
