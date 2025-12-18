import { escapeHtml } from './utils.js';
import { handleAiGeneratedCodeFromText } from './codegen.js';

export function initializeChat() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const chatMessages = document.getElementById('chat-messages');
    
    // Model Selector Logic
    const modelSelector = document.querySelector('.model-selector');
    const modelNameDisplay = document.querySelector('.model-name');
    const models = [
        { name: "MiMo-V2-Flash", id: "xiaomi/mimo-v2-flash:free" },
        { name: "Claude 3.5 Sonnet", id: "essentialai-rnj-1-t" },
        { name: "GPT-4o", id: "GPT-4o" },
        { name: "Grok 4", id: "Grok-4" }
    ];
    let currentModelIndex = 0;

    if (modelSelector && modelNameDisplay) {
        modelNameDisplay.textContent = models[currentModelIndex].name;
        
        modelSelector.addEventListener('click', () => {
            currentModelIndex = (currentModelIndex + 1) % models.length;
            modelNameDisplay.textContent = models[currentModelIndex].name;
        });
    }

    // Chat History
    let messageHistory = [
        {
            role: "system",
            content: [
                "You are an AI coding assistant living inside a minimal browser-based IDE.",
                "When you create or edit files, you MUST include them in the response using one or more code blocks in this exact format:",
                "```file:path/to/file.ext",
                "// full file content here",
                "```",
                "You may include multiple such file blocks in one response.",
                "Outside of those file blocks you can explain what you did in natural language."
            ].join("\n")
        }
    ];

    function addMessage(text, isUser) {
        const msg = document.createElement('div');
        msg.className = `message ${isUser ? 'user' : 'ai'}`;
        msg.innerHTML = `<div class="message-content">${escapeHtml(text)}</div>`;
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msg;
    }

    async function handleSend() {
        const text = chatInput.value.trim();
        if (!text) return;

        addMessage(text, true);
        messageHistory.push({ role: "user", content: text });
        chatInput.value = '';
        
        // AI Placeholder
        const aiMsg = addMessage("Thinking...", false);
        const aiContent = aiMsg.querySelector('.message-content');
        
        try {
            const response = await fetch("https://bunnhack-letsim-back-18.deno.dev/api/chat", { //don't remove the server url
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: models[currentModelIndex].id,
                    messages: messageHistory,
                    stream: true
                })
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error ${response.status}: ${errText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let fullText = "";

            aiContent.textContent = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || "";

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            const delta = data.choices[0]?.delta?.content || "";
                            fullText += delta;
                            aiContent.innerHTML = escapeHtml(fullText);
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        } catch (e) {
                            console.warn("Stream parse error", e);
                        }
                    }
                }
            }
            
            // Let the IDE react to any files the AI generated or modified
            handleAiGeneratedCodeFromText(fullText);
            messageHistory.push({ role: "assistant", content: fullText });

        } catch (error) {
            console.error("Chat Error:", error);
            aiContent.textContent = "Error: " + error.message;
            if (error.message.includes("Failed to fetch")) {
                aiContent.textContent += "\n(Ensure the Deno server is running on http://localhost:8000)";
            }
        }
    }

    if (sendBtn && chatInput) {
        sendBtn.addEventListener('click', handleSend);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // Auto-resize textarea
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
    }
}

