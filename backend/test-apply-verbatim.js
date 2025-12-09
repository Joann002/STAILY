/**
 * Test de la route apply-verbatim
 */

const testSegments = [
  { id: 1, start: 0, end: 3, text: "Euh, bonjour tout le monde" },
  { id: 2, start: 3, end: 6, text: "Hum, je suis content de vous voir" },
  { id: 3, start: 6, end: 9, text: "Allez, ciao" }
];

async function testApplyVerbatim() {
  console.log('🧪 Test de la route /apply-verbatim\n');
  
  try {
    const response = await fetch('http://localhost:3002/apply-verbatim', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        segments: testSegments
      }),
    });

    const data = await response.json();
    
    console.log('📥 Réponse complète:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('\n✅ Succès !');
      console.log('\n📊 Statistiques:');
      console.log(`- Total segments: ${data.statistics.totalSegments}`);
      console.log(`- Segments modifiés: ${data.statistics.segmentsModified}`);
      console.log(`- Tokens utilisés: ${data.statistics.tokensUsed}`);
      
      console.log('\n📄 Version brute:');
      data.raw.segments.forEach(seg => {
        console.log(`  [${seg.id}] ${seg.text}`);
      });
      
      console.log('\n✨ Version corrigée:');
      data.corrected.segments.forEach(seg => {
        console.log(`  [${seg.id}] ${seg.text}`);
      });
    } else {
      console.log('\n❌ Erreur:', data.error);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

testApplyVerbatim();
