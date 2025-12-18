import { initializeUI } from './modules/ui.js';
import { initializeSidebar } from './modules/sidebar.js';
import { initializeExplorer } from './modules/explorer.js';
import { initializeChat } from './modules/chat.js';
import { initializePreview } from './modules/preview.js';
import { initializeWebcontainer } from './modules/webcontainer.js';

document.addEventListener('DOMContentLoaded', () => {
    initializeUI();
    initializeSidebar();
    initializeExplorer();
    initializeChat();
    initializePreview();
    initializeWebcontainer();
});

