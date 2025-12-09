#!/bin/bash

# 🛑 Script d'arrêt - Stoppe Backend + Frontend

echo ""
echo "🛑 Arrêt de l'application..."
echo ""

# Arrêter le backend
echo "   Arrêt du backend..."
pkill -f "node server.js" 2>/dev/null
if [ $? -eq 0 ]; then
  echo "   ✅ Backend arrêté"
else
  echo "   ℹ️  Aucun backend en cours"
fi

# Arrêter le frontend
echo "   Arrêt du frontend..."
pkill -f "next dev" 2>/dev/null
if [ $? -eq 0 ]; then
  echo "   ✅ Frontend arrêté"
else
  echo "   ℹ️  Aucun frontend en cours"
fi

echo ""
echo "✅ Tous les processus ont été arrêtés"
echo ""
