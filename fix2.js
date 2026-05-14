const fs = require('fs');
const file = 'c:/Users/Shreya Shristi/Documents/CodeSync/client/src/app/workspace/workspace.ts';
let c = fs.readFileSync(file, 'utf8');

// Replace any occurrence of single-quoted real newline with single-quoted \n
c = c.replace(/'\r?\n'/g, "'\\n'");

// Replace any occurrence of double-quoted real newline with double-quoted \n
c = c.replace(/"\r?\n"/g, '"\\n"');

// Fix TS18047 possibly null issue
// The issue is: this.collabService.endSession(fileId, String(user.userId)
c = c.replace(/String\(user\.userId\)/g, "String(user!.userId)");

fs.writeFileSync(file, c, 'utf8');
console.log('Fixed multiline string errors and TS18047');
