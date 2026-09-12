const fs = require('fs');
const html = fs.readFileSync('github_pr_checker.html', 'utf8');

if (!html.includes('aria-label="Filter repositories by name"')) {
  throw new Error("ARIA label missing!");
}
console.log("HTML looks good!");
