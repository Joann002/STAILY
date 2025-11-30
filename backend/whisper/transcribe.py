#!/usr/bin/env python3
"""
Script de transcription audio avec faster-whisper
Convertit un fichier audio WAV en JSON avec segments temporels
"""

import sys
import json
import os
from pathlib import Path
from faster_whisper import WhisperModel

def transcribe_audio(audio_path, model_size="base", language=None):
    """
    Transcrit un fichier audio avec faster-whisper
    
    Args:
        audio_path (str): Chemin du fichier audio WAV
        model_size (str): Taille du modèle (tiny, base, small, medium, large-v3)
        language (str): Code langue (fr, en, etc.) ou None pour détection auto
    
    Returns:
        dict: Résultat de transcription avec segments
    """
    
    # Vérifier que le fichier existe
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Fichier audio introuvable: {audio_path}")
    
    print(f"🎤 Chargement du modèle Whisper '{model_size}'...", file=sys.stderr)
    
    # Charger le modèle Whisper
    # device="cpu" pour CPU, "cuda" pour GPU
    # compute_type="int8" pour CPU (plus rapide), "float16" pour GPU
    model = WhisperModel(
        model_size,
        device="cpu",
        compute_type="int8"
    )
    
    print(f"🎵 Transcription de: {audio_path}", file=sys.stderr)
    
    # Transcrire l'audio
    # beam_size: taille du faisceau de recherche (5 = bon compromis)
    # language: langue de l'audio (None = détection automatique)
    # vad_filter: filtre de détection de voix (réduit les segments vides)
    segments, info = model.transcribe(
        audio_path,
        beam_size=5,
        language=language,
        vad_filter=True,
        word_timestamps=False
    )
    
    print(f"✅ Langue détectée: {info.language} (probabilité: {info.language_probability:.2f})", file=sys.stderr)
    
    # Construire le résultat JSON
    result = {
        "language": info.language,
        "language_probability": round(info.language_probability, 4),
        "duration": round(info.duration, 2),
        "segments": []
    }
    
    # Extraire les segments avec timestamps
    for segment in segments:
        result["segments"].append({
            "id": segment.id,
            "start": round(segment.start, 2),
            "end": round(segment.end, 2),
            "text": segment.text.strip()
        })
        print(f"  [{segment.start:.2f}s → {segment.end:.2f}s] {segment.text.strip()}", file=sys.stderr)
    
    print(f"✅ Transcription terminée: {len(result['segments'])} segments", file=sys.stderr)
    
    return result


def main():
    """Point d'entrée du script"""
    
    # Vérifier les arguments
    if len(sys.argv) < 2:
        print("❌ Usage: python transcribe.py <audio.wav> [model_size] [language]", file=sys.stderr)
        print("   Exemple: python transcribe.py tmp/audio.wav base fr", file=sys.stderr)
        print("   Modèles: tiny, base, small, medium, large-v3", file=sys.stderr)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"
    language = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        # Transcrire l'audio
        result = transcribe_audio(audio_path, model_size, language)
        
        # Générer le chemin du fichier JSON de sortie
        # tmp/audio.wav → tmp/audio.json
        audio_file = Path(audio_path)
        json_path = audio_file.with_suffix('.json')
        
        # Sauvegarder le résultat en JSON
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        
        print(f"💾 JSON sauvegardé: {json_path}", file=sys.stderr)
        
        # Afficher le JSON sur stdout (pour Node.js)
        print(json.dumps(result, ensure_ascii=False))
        
        sys.exit(0)
        
    except Exception as e:
        print(f"❌ Erreur: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
