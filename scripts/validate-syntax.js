// Simple syntax validation script
// Run with: node scripts/validate-syntax.js

const fs = require('fs');
const path = require('path');

function validateJavaScriptFile(filePath){
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let braceCount = 0;
  let parenCount = 0;
  let bracketCount = 0;
  const issues = [];
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Count braces
    for (const char of line){
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;
      if (char === '(') parenCount++;
      if (char === ')') parenCount--;
      if (char === '[') bracketCount++;
      if (char === ']') bracketCount--;
    }
    
    // Check for negative counts (too many closing)
    if (braceCount < 0){
      issues.push(`Line ${lineNum}: Too many closing braces '}'`);
    }
    if (parenCount < 0){
      issues.push(`Line ${lineNum}: Too many closing parentheses ')'`);
    }
    if (bracketCount < 0){
      issues.push(`Line ${bracketCount}: Too many closing brackets ']'`);
    }
  });
  
  // Check for unclosed
  if (braceCount !== 0){
    issues.push(`Unclosed braces: ${braceCount > 0 ? braceCount + ' open' : Math.abs(braceCount) + ' extra close'}`);
  }
  if (parenCount !== 0){
    issues.push(`Unclosed parentheses: ${parenCount > 0 ? parenCount + ' open' : Math.abs(parenCount) + ' extra close'}`);
  }
  if (bracketCount !== 0){
    issues.push(`Unclosed brackets: ${bracketCount > 0 ? bracketCount + ' open' : Math.abs(bracketCount) + ' extra close'}`);
  }
  
  return issues;
}

// Validate main files
const filesToCheck = [
  'app.js',
  'compare.js',
  'gear.js'
];

console.log('Validating JavaScript syntax...\n');

let hasErrors = false;

filesToCheck.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)){
    const issues = validateJavaScriptFile(filePath);
    if (issues.length > 0){
      console.error(`❌ ${file}:`);
      issues.forEach(issue => console.error(`   ${issue}`));
      hasErrors = true;
    } else {
      console.log(`✅ ${file}: OK`);
    }
  }
});

if (hasErrors){
  console.error('\n❌ Validation failed!');
  process.exit(1);
} else {
  console.log('\n✅ All files validated successfully!');
  process.exit(0);
}
