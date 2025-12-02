#!/usr/bin/env python3
"""
Script pour pré-télécharger tous les modèles Whisper
Permet une utilisation hors ligne après le téléchargement initial
"""

import sys
from faster_whisper import WhisperModel

# Liste de tous les modèles à télécharger
MODELS = [
    'tiny',
    'base', 
    'small',
    'medium',
    'large-v3'
]

def download_model(model_name):
    """
    Télécharge et met en cache un modèle Whisper
    """
    try:
        print(f"\n{'='*60}")
        print(f"📥 Téléchargement du modèle: {model_name}")
        print(f"{'='*60}")
        
        # Charger le modèle (le télécharge si nécessaire)
        model = WhisperModel(
            model_name,
            device="cpu",
            compute_type="int8"
        )
        
        print(f"✅ Modèle {model_name} téléchargé et mis en cache")
        return True
        
    except Exception as e:
        print(f"❌ Erreur lors du téléchargement de {model_name}: {str(e)}")
        return False

def main():
    """
    Télécharge tous les modèles Whisper
    """
    print("🎤 PRÉ-TÉLÉCHARGEMENT DES MODÈLES WHISPER")
    print("=" * 60)
    print("Les modèles seront téléchargés dans:")
    print("~/.cache/huggingface/hub/")
    print("\nTailles approximatives:")
    print("  • tiny:     ~75 MB")
    print("  • base:     ~145 MB")
    print("  • small:    ~466 MB")
    print("  • medium:   ~1.5 GB")
    print("  • large-v3: ~3 GB")
    print(f"\nTotal: ~5.2 GB")
    print("=" * 60)
    
    # Demander confirmation
    if len(sys.argv) > 1 and sys.argv[1] == '--yes':
        confirm = 'y'
    else:
        confirm = input("\n⚠️  Continuer le téléchargement? (y/n): ").lower()
    
    if confirm != 'y':
        print("❌ Téléchargement annulé")
        sys.exit(0)
    
    # Télécharger chaque modèle
    results = {}
    for model_name in MODELS:
        success = download_model(model_name)
        results[model_name] = success
    
    # Résumé
    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ DU TÉLÉCHARGEMENT")
    print("=" * 60)
    
    success_count = sum(1 for v in results.values() if v)
    total_count = len(results)
    
    for model_name, success in results.items():
        status = "✅" if success else "❌"
        print(f"{status} {model_name}")
    
    print("=" * 60)
    print(f"✅ {success_count}/{total_count} modèles téléchargés avec succès")
    
    if success_count == total_count:
        print("\n🎉 Tous les modèles sont prêts pour une utilisation hors ligne!")
    else:
        print("\n⚠️  Certains modèles n'ont pas pu être téléchargés")
        sys.exit(1)

if __name__ == "__main__":
    main()
