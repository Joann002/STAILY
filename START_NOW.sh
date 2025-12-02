#!/bin/bash

# 🚀 Script de démarrage rapide
# Lance le backend et le frontend automatiquement

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "🚀 Démarrage de l'application Transcription"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Vérifier que nous sommes dans le bon dossier
if [ ! -d "backend" ] || [ ! -d "Staily-Front" ]; then
  echo "❌ Erreur: Ce script doit être exécuté depuis la racine du projet"
  echo "   (le dossier contenant 'backend' et 'Staily-Front')"
  exit 1
fi

# Fonction pour tuer les processus à la fin
cleanup() {
  echo ""
  echo "🛑 Arrêt des serveurs..."
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  exit 0
}

trap cleanup SIGINT SIGTERM

# Démarrer le backend
echo "📍 Étape 1/2: Démarrage du backend..."
echo "────────────────────────────────────────────────────────────────"
cd backend
npm start > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

echo "   ✅ Backend démarré (PID: $BACKEND_PID)"
echo "   📝 Logs: backend.log"
echo ""

# Attendre que le backend soit prêt
echo "⏳ Attente du backend (5 secondes)..."
sleep 5

# Vérifier que le backend répond
if curl -s http://localhost:3002/ > /dev/null 2>&1; then
  echo "   ✅ Backend opérationnel sur http://localhost:3002"
else
  echo "   ⚠️  Backend ne répond pas encore, mais on continue..."
fi

echo ""

# Démarrer le frontend
echo "📍 Étape 2/2: Démarrage du frontend..."
echo "────────────────────────────────────────────────────────────────"

# Charger nvm et utiliser Node.js v20
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  echo "   🔧 Chargement de nvm..."
  . "$NVM_DIR/nvm.sh"
  echo "   🔄 Passage à Node.js v20..."
  nvm use v20 > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "   ✅ Node.js v20 activé"
  else
    echo "   ⚠️  Node.js v20 non trouvé, utilisation de la version actuelle"
  fi
else
  echo "   ⚠️  nvm non trouvé, utilisation de la version Node.js actuelle"
fi

cd Staily-Front
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo "   ✅ Frontend démarré (PID: $FRONTEND_PID)"
echo "   📝 Logs: frontend.log"
echo ""

# Attendre que le frontend soit prêt
echo "⏳ Attente du frontend (10 secondes)..."
sleep 10

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ Application démarrée avec succès !"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "🌐 URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:3002"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🧪 Test du cache:"
echo "   bash backend/test-cache.sh"
echo ""
echo "🛑 Pour arrêter: Ctrl+C"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# Ouvrir le navigateur (optionnel)
if command -v xdg-open > /dev/null 2>&1; then
  echo "🌐 Ouverture du navigateur..."
  xdg-open http://localhost:3000 2>/dev/null &
elif command -v open > /dev/null 2>&1; then
  echo "🌐 Ouverture du navigateur..."
  open http://localhost:3000 2>/dev/null &
fi

# Garder le script actif
echo "⏳ Serveurs en cours d'exécution... (Ctrl+C pour arrêter)"
echo ""

# Afficher les logs en temps réel
tail -f backend.log frontend.log 2>/dev/null &
TAIL_PID=$!

# Attendre indéfiniment
wait $BACKEND_PID $FRONTEND_PID
