// Content script - Runs on localhost pages to make text editable

let isEditMode = false;
let projectPath = '';
let specificFile = '';
let originalTexts = new Map();

console.log('LiveText extension loaded!');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggleEditMode') {
        isEditMode = request.editMode;
        projectPath = request.projectPath;
        specificFile = request.specificFile || '';
        
        if (isEditMode) {
            enableEditMode();
        } else {
            disableEditMode();
        }
    }
});

// Listen for keyboard shortcut (Ctrl+Shift+E)
document.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        
        // Get current state and project path
        const result = await chrome.storage.local.get(['editMode', 'projectPath']);
        
        if (!result.projectPath) {
            showNotification('⚠️ Please set project path in extension popup first!');
            return;
        }
        
        isEditMode = !result.editMode;
        projectPath = result.projectPath;
        
        await chrome.storage.local.set({ editMode: isEditMode });
        
        if (isEditMode) {
            enableEditMode();
        } else {
            disableEditMode();
        }
    }
});

function enableEditMode() {
    document.body.style.outline = '3px solid #00ff00';
    showNotification('🟢 LiveText: Edit mode ON! Click any text to edit.');
    makeTextEditable();
}

function disableEditMode() {
    document.body.style.outline = 'none';
    showNotification('⚫ LiveText: Edit mode OFF');
    removeEditability();
}

function makeTextEditable() {
    // Find all text elements
    const textElements = document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, div, a, button, li, td, th, label');
    
    textElements.forEach(el => {
        // Skip if already editable or has no direct text content
        if (el.hasAttribute('data-livetext-editable')) return;
        
        // Only make it editable if it has direct text (not just children)
        const hasDirectText = Array.from(el.childNodes).some(
            node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
        );
        
        if (!hasDirectText) return;
        
        el.setAttribute('data-livetext-editable', 'true');
        el.style.outline = '1px dashed #0088ff';
        el.style.cursor = 'text';
        
        // Save original text content
        originalTexts.set(el, el.textContent.trim());
        
        // Make contentEditable
        el.setAttribute('contenteditable', 'true');
        
        // Listen for blur (when user clicks away)
        el.addEventListener('blur', handleTextChange);
        
        // Prevent default link behavior while editing
        if (el.tagName === 'A') {
            el.addEventListener('click', (e) => {
                if (isEditMode) e.preventDefault();
            });
        }
    });
}

function removeEditability() {
    const editableElements = document.querySelectorAll('[data-livetext-editable]');
    
    editableElements.forEach(el => {
        el.removeAttribute('data-livetext-editable');
        el.removeAttribute('contenteditable');
        el.style.outline = 'none';
        el.style.cursor = '';
        el.removeEventListener('blur', handleTextChange);
    });
    
    originalTexts.clear();
}

async function handleTextChange(event) {
    const element = event.target;
    const oldText = originalTexts.get(element);
    const newText = element.textContent.trim();
    
    if (oldText === newText || !oldText) {
        return;
    }
    
    console.log('Text changed:', { oldText, newText });
    
    // Send to background script to save
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'saveTextChange',
            oldText: oldText,
            newText: newText,
            projectPath: projectPath,
            specificFile: specificFile,
            url: window.location.href
        });
        
        if (response && response.success) {
            const lineInfo = response.lineNumber ? ` (line ${response.lineNumber})` : '';
            showNotification(`✓ Saved to: ${response.fileName || 'file'}${lineInfo}`);
            originalTexts.set(element, newText);
        } else {
            const errorMsg = response?.error || 'Unknown error';
            showNotification(`✗ Failed: ${errorMsg}`);
            console.log('Save failed:', response);
            element.textContent = oldText;
        }
    } catch (error) {
        console.error('Error saving text:', error);
        
        // Check if extension was reloaded
        if (error.message.includes('Extension context invalidated')) {
            showNotification('🔄 Extension reloaded - Please refresh this page (F5)');
        } else {
            showNotification('✗ Error saving text - Check console');
        }
        element.textContent = oldText;
    }
}

function showNotification(message) {
    // Remove existing notification
    const existing = document.getElementById('livetext-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.id = 'livetext-notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #333;
        color: #fff;
        padding: 12px 20px;
        border-radius: 5px;
        z-index: 999999;
        font-size: 14px;
        font-family: system-ui, -apple-system, sans-serif;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideIn 0.3s ease;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Show initial message
setTimeout(() => {
    showNotification('💡 LiveText loaded! Press Ctrl+Shift+E or use extension popup to start editing');
}, 1000);

