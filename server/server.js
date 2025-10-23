// Simple standalone server for LiveText Chrome Extension
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;

console.log('🚀 Starting LiveText server...');

const server = http.createServer((req, res) => {
    // Enable CORS for localhost
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/update-text') {
        let body = '';
        
        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                console.log('\n📝 Received text change request:');
                console.log('   Old text:', data.oldText.substring(0, 50) + '...');
                console.log('   New text:', data.newText.substring(0, 50) + '...');
                console.log('   File:', data.filePath);
                
                const result = updateFileText(data.filePath, data.oldText, data.newText);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (error) {
                console.error('❌ Error:', error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false, 
                    error: error.message 
                }));
            }
        });
    } else if (req.method === 'GET' && req.url === '/') {
        // Health check
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('LiveText server is running! 🎉');
    } else {
        res.writeHead(404);
        res.end();
    }
});

function updateFileText(filePath, oldText, newText) {
    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.log('❌ File not found:', filePath);
            return { 
                success: false, 
                error: 'File not found',
                fileName: path.basename(filePath)
            };
        }
        
        // Read the file
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // Find the line number where the text appears
        const lines = content.split('\n');
        let lineNumber = -1;
        let lineText = '';
        
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(oldText)) {
                lineNumber = i + 1; // Line numbers start at 1
                lineText = lines[i].trim();
                break;
            }
        }
        
        // Replace the old text with new text
        const updatedContent = content.replace(oldText, newText);
        
        if (content === updatedContent) {
            console.log('⚠️  Text not found in file');
            console.log('   Searched for:', oldText.substring(0, 100));
            return { 
                success: false, 
                error: 'Text not found in file',
                fileName: path.basename(filePath)
            };
        }
        
        // Write back to the file
        fs.writeFileSync(filePath, updatedContent, 'utf-8');
        
        console.log('✅ File updated successfully!');
        console.log('   File:', path.basename(filePath));
        if (lineNumber > 0) {
            console.log('   Line:', lineNumber);
            console.log('   Before:', lineText.substring(0, 80));
        }
        
        return { 
            success: true, 
            fileName: path.basename(filePath),
            lineNumber: lineNumber
        };
    } catch (error) {
        console.error('❌ Error updating file:', error.message);
        return { 
            success: false, 
            error: error.message,
            fileName: filePath ? path.basename(filePath) : 'unknown'
        };
    }
}

server.listen(PORT, () => {
    console.log('\n✅ LiveText server is running!');
    console.log(`   Port: ${PORT}`);
    console.log(`   URL: http://localhost:${PORT}`);
    console.log('\n💡 Ready to receive text changes from Chrome extension!');
    console.log('   Press Ctrl+C to stop the server\n');
});

// Handle shutdown gracefully
process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down LiveText server...');
    server.close(() => {
        console.log('✅ Server stopped');
        process.exit(0);
    });
});

