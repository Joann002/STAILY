const { computeHash } = require('./services/cacheManager');
const path = require('path');

async function test() {
  const files = [
    path.join(__dirname, 'uploads/Bonus_Soral_rA_pond_-_comment_sera_la_France_en_20-1764527983039-641395439.mp4'),
    path.join(__dirname, 'uploads/Bonus_Soral_rA_pond_-_comment_sera_la_France_en_20-1764540401763-787668584.mp4'),
    path.join(__dirname, 'uploads/Bonus_Soral_rA_pond_-_comment_sera_la_France_en_20-1764540431201-57762862.mp4')
  ];
  
  console.log('🔍 Test des hash pour les 3 fichiers uploadés:\n');
  
  for (const file of files) {
    try {
      const hash = await computeHash(file);
      console.log(`${path.basename(file).substring(0, 50)}...`);
      console.log(`   Hash: ${hash.substring(0, 16)}...${hash.substring(hash.length - 8)}\n`);
    } catch (err) {
      console.log(`${file}: ERREUR - ${err.message}\n`);
    }
  }
}

test();
