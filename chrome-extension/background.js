// Background service worker - Handles file saving via Native Messaging

console.log('LiveText background service worker loaded');

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'saveTextChange') {
        handleSaveText(request)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response
    }
});

async function handleSaveText({ oldText, newText, projectPath, specificFile, url }) {
    console.log('Attempting to save text change:', { oldText, newText, projectPath, specificFile });
    
    try {
        let possibleFiles = [];
        
        // If specific file is set, try that first
        if (specificFile) {
            possibleFiles.push(specificFile);
        }
        
        // Also try auto-detected locations
        if (projectPath) {
            const urlPath = new URL(url).pathname;
            possibleFiles = possibleFiles.concat(detectPossibleFiles(urlPath, projectPath));
        }
        
        console.log('Trying these file locations:', possibleFiles);
        
        // Try each possible file location
        for (const fileName of possibleFiles) {
            try {
                console.log('Attempting:', fileName);
                
                const response = await fetch('http://localhost:3456/update-text', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        filePath: fileName,
                        oldText: oldText,
                        newText: newText
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    console.log('✓ Success! Saved to:', fileName);
                    return { 
                        success: true, 
                        fileName: fileName.split('\\').pop(),
                        lineNumber: result.lineNumber
                    };
                } else {
                    console.log('✗ Failed for:', fileName, result.error);
                }
            } catch (fetchError) {
                console.error('Fetch error:', fetchError);
                return { 
                    success: false, 
                    error: 'Server not running',
                    message: 'Please start the LiveText server (port 3456)'
                };
            }
        }
        
        // None worked
        return { 
            success: false, 
            error: 'Text not found in any file. Tried: ' + possibleFiles.map(f => f.split('\\').pop()).join(', ')
        };
        
    } catch (error) {
        console.error('Error in handleSaveText:', error);
        return { success: false, error: error.message };
    }
}

function detectPossibleFiles(urlPath, projectPath) {
    // Return array of possible file locations to try
    const files = [];
    
    if (urlPath === '/' || urlPath === '') {
        // Homepage - try multiple common locations
        files.push(`${projectPath}\\app\\page.tsx`);
        files.push(`${projectPath}\\app\\page.jsx`);
        files.push(`${projectPath}\\pages\\index.tsx`);
        files.push(`${projectPath}\\pages\\index.jsx`);
        files.push(`${projectPath}\\src\\app\\page.tsx`);
        files.push(`${projectPath}\\src\\pages\\index.tsx`);
    } else {
        // Remove leading slash and construct paths
        const cleanPath = urlPath.replace(/^\//, '').replace(/\/$/, '');
        
        // Try App Router paths
        files.push(`${projectPath}\\app\\${cleanPath}\\page.tsx`);
        files.push(`${projectPath}\\app\\${cleanPath}\\page.jsx`);
        files.push(`${projectPath}\\src\\app\\${cleanPath}\\page.tsx`);
        
        // Try Pages Router paths
        files.push(`${projectPath}\\pages\\${cleanPath}.tsx`);
        files.push(`${projectPath}\\pages\\${cleanPath}.jsx`);
        files.push(`${projectPath}\\pages\\${cleanPath}\\index.tsx`);
        files.push(`${projectPath}\\src\\pages\\${cleanPath}.tsx`);
    }
    
    return files;
}

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
    console.log('LiveText extension installed!');
});

