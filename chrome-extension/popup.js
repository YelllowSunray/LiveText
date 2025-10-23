// Popup controls for LiveText Chrome Extension

document.addEventListener('DOMContentLoaded', async () => {
    const toggleBtn = document.getElementById('toggleBtn');
    const savePathBtn = document.getElementById('savePathBtn');
    const statusDiv = document.getElementById('status');
    const projectPathInput = document.getElementById('projectPath');
    const specificFileInput = document.getElementById('specificFile');
    
    // Load saved paths
    const result = await chrome.storage.local.get(['projectPath', 'specificFile', 'editMode']);
    if (result.projectPath) {
        projectPathInput.value = result.projectPath;
    }
    if (result.specificFile) {
        specificFileInput.value = result.specificFile;
    }
    
    // Update status display
    updateStatus(result.editMode || false);
    
    // Save paths
    savePathBtn.addEventListener('click', async () => {
        const path = projectPathInput.value.trim();
        const specificFile = specificFileInput.value.trim();
        
        if (path || specificFile) {
            await chrome.storage.local.set({ 
                projectPath: path,
                specificFile: specificFile
            });
            alert('✓ Settings saved!');
        } else {
            alert('Please enter at least one path');
        }
    });
    
    // Toggle edit mode
    toggleBtn.addEventListener('click', async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Check if we're on localhost
        if (!tab.url.includes('localhost') && !tab.url.includes('127.0.0.1')) {
            alert('⚠️ This extension only works on localhost pages!');
            return;
        }
        
        // Check if paths are set
        const { projectPath, specificFile } = await chrome.storage.local.get(['projectPath', 'specificFile']);
        if (!projectPath && !specificFile) {
            alert('⚠️ Please set your project folder path or specific file first!');
            return;
        }
        
        // Toggle edit mode
        const { editMode } = await chrome.storage.local.get('editMode');
        const newMode = !editMode;
        
        await chrome.storage.local.set({ editMode: newMode });
        
        // Send message to content script
        chrome.tabs.sendMessage(tab.id, { 
            action: 'toggleEditMode',
            editMode: newMode,
            projectPath: projectPath,
            specificFile: specificFile
        });
        
        updateStatus(newMode);
    });
    
    function updateStatus(isActive) {
        if (isActive) {
            statusDiv.className = 'status active';
            statusDiv.textContent = '🟢 Edit Mode: ON';
            toggleBtn.textContent = 'Disable Edit Mode';
            toggleBtn.className = 'danger';
        } else {
            statusDiv.className = 'status inactive';
            statusDiv.textContent = '⚫ Edit Mode: OFF';
            toggleBtn.textContent = 'Enable Edit Mode';
            toggleBtn.className = 'primary';
        }
    }
});

