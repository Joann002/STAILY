#!/usr/bin/env python3
"""
Script Python pour appeler l'API OpenAI GPT-4o-mini
Usage: python ai.py <prompt> [--system <system_message>] [--temperature <temp>] [--max-tokens <tokens>]
"""

import sys
import json
import os
from openai import OpenAI

def main():
    # Récupérer les arguments
    if len(sys.argv) < 2:
        print(json.dumps({
            "success": False,
            "error": "Usage: python ai.py <prompt> [--system <system_message>] [--temperature <temp>] [--max-tokens <tokens>]"
        }))
        sys.exit(1)
    
    # Parser les arguments
    prompt = sys.argv[1]
    system_message = "Tu es un assistant IA utile et précis."
    temperature = 0.7
    max_tokens = 1000
    
    # Parser les arguments optionnels
    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == "--system" and i + 1 < len(sys.argv):
            system_message = sys.argv[i + 1]
            i += 2
        elif sys.argv[i] == "--temperature" and i + 1 < len(sys.argv):
            temperature = float(sys.argv[i + 1])
            i += 2
        elif sys.argv[i] == "--max-tokens" and i + 1 < len(sys.argv):
            max_tokens = int(sys.argv[i + 1])
            i += 2
        else:
            i += 1
    
    # Vérifier la clé API
    api_key = os.getenv('OPENAI_API_KEY')
    if not api_key:
        print(json.dumps({
            "success": False,
            "error": "OPENAI_API_KEY non définie dans les variables d'environnement"
        }))
        sys.exit(1)
    
    try:
        # Initialiser le client OpenAI
        client = OpenAI(api_key=api_key)
        
        # Appeler l'API GPT-4o-mini
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_message},
                {"role": "user", "content": prompt}
            ],
            temperature=temperature,
            max_tokens=max_tokens
        )
        
        # Extraire la réponse
        content = response.choices[0].message.content
        
        # Retourner le résultat en JSON
        result = {
            "success": True,
            "response": content,
            "model": response.model,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens
            }
        }
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({
            "success": False,
            "error": str(e)
        }))
        sys.exit(1)

if __name__ == "__main__":
    main()
