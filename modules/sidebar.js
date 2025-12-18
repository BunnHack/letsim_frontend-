export function initializeSidebar() {
    const aiChatBtn = document.getElementById('ai-chat-btn');
    const aiSidebar = document.getElementById('ai-sidebar');
    const fileExplorerBtn = document.getElementById('file-explorer-btn');
    const fileExplorer = document.getElementById('file-explorer');
    
    // Sidebar switching helper
    function updateSidebarState() {
        // Handle File Explorer Button State
        if (fileExplorer.classList.contains('active')) {
            const iconBox = fileExplorerBtn.querySelector('.sidebar-icon-box');
            iconBox.classList.add('active-sidebar-btn');
            iconBox.style.backgroundColor = 'var(--btn-hover)';
            iconBox.querySelector('svg').style.stroke = 'var(--text-primary)';
        } else {
            const iconBox = fileExplorerBtn.querySelector('.sidebar-icon-box');
            iconBox.classList.remove('active-sidebar-btn');
            iconBox.style.backgroundColor = '';
            iconBox.querySelector('svg').style.stroke = '#a1a1aa';
        }

        // Handle AI Chat Button State - Primary button keeps its purple background
    }

    // Toggle File Explorer
    fileExplorerBtn.addEventListener('click', () => {
        // Close AI if open
        if (aiSidebar.classList.contains('active')) {
            aiSidebar.classList.remove('active');
        }
        
        fileExplorer.classList.toggle('active');
        updateSidebarState();
    });

    // Toggle AI Chat
    aiChatBtn.addEventListener('click', () => {
        // Close File Explorer if open
        if (fileExplorer.classList.contains('active')) {
            fileExplorer.classList.remove('active');
        }

        aiSidebar.classList.toggle('active');
        updateSidebarState();
    });
}

