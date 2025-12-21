import { escapeHtml } from './utils.js';
import { handleAiGeneratedCodeFromText } from './codegen.js';
import { runCommand } from './webcontainer.js';

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

    const tools = [
        {
            type: "function",
            function: {
                name: "run_command",
                description: "Run a shell command inside the in-browser WebContainer terminal for this project.",
                parameters: {
                    type: "object",
                    properties: {
                        command: {
                            type: "string",
                            description: "The full shell command to execute, for example: 'ls -la', 'npm test', or 'cat package.json'."
                        }
                    },
                    required: ["command"]
                }
            }
        }
    ];

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
                "Outside of those file blocks you can explain what you did in natural language.",
                "",
                "You also have access to tools. When appropriate, use the `run_command` tool instead of guessing terminal output, to run commands inside the WebContainer project (for example `npm test`, `ls`, or `cat package.json`)."
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
        
        const aiMsg = addMessage("Thinking...", false);
        const aiContent = aiMsg.querySelector('.message-content');
        
        try {
            await runChatLoopWithTools(aiContent);
        } catch (error) {
            console.error("Chat Error:", error);
            aiContent.textContent = "Error: " + error.message;
            if (error.message.includes("Failed to fetch")) {
                aiContent.textContent += "\n(Ensure the Deno server is running on http://localhost:8000)";
            }
        }
    }

    async function runChatLoopWithTools(aiContent) {
        // Allow a couple of tool -> model iterations to satisfy tool calls.
        for (let i = 0; i < 3; i++) {
            const result = await callModelOnce(aiContent);

            if (result.type === 'tool_call' && result.toolCalls.length) {
                // Record the assistant tool-call message.
                messageHistory.push({
                    role: "assistant",
                    tool_calls: result.toolCalls.map(tc => ({
                        id: tc.id,
                        type: "function",
                        function: {
                            name: tc.function?.name || "",
                            arguments: tc.function?.arguments || ""
                        }
                    }))
                });

                await executeToolCalls(result.toolCalls);
                // Loop again so the model can see tool outputs.
                continue;
            }

            const content = result.content || "";
            if (content) {
                handleAiGeneratedCodeFromText(content);
                messageHistory.push({ role: "assistant", content });
            }
            break;
        }
    }

    async function callModelOnce(aiContent) {
        const response = await fetch("https://bunnhack-letsim-back-18.deno.dev/api/chat", { //don't remove the server url
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: models[currentModelIndex].id,
                messages: messageHistory,
                stream: true,
                tools,
                tool_choice: "auto"
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
        let toolCalls = [];
        let sawToolCalls = false;

        aiContent.textContent = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                if (trimmed === 'data: [DONE]') {
                    continue;
                }
                if (!trimmed.startsWith('data: ')) continue;

                try {
                    const data = JSON.parse(trimmed.slice(6));
                    const choice = data.choices && data.choices[0];
                    if (!choice) continue;

                    const delta = choice.delta || {};

                    // Streaming assistant text content
                    if (typeof delta.content === "string") {
                        fullText += delta.content;
                        aiContent.innerHTML = escapeHtml(fullText);
                        chatMessages.scrollTop = chatMessages.scrollHeight;
                    }

                    // Streaming tool calls
                    if (Array.isArray(delta.tool_calls) && delta.tool_calls.length) {
                        sawToolCalls = true;
                        delta.tool_calls.forEach((tcDelta, index) => {
                            const existing = toolCalls[index] || {
                                id: "",
                                type: "function",
                                function: { name: "", arguments: "" }
                            };

                            if (tcDelta.id) {
                                existing.id = tcDelta.id;
                            }
                            if (tcDelta.function?.name) {
                                existing.function.name = tcDelta.function.name;
                            }
                            if (tcDelta.function?.arguments) {
                                existing.function.arguments += tcDelta.function.arguments;
                            }

                            toolCalls[index] = existing;
                        });
                    }
                } catch (e) {
                    console.warn("Stream parse error", e);
                }
            }
        }

        if (sawToolCalls && !fullText) {
            aiContent.textContent = "Running tools...";
            return { type: "tool_call", content: "", toolCalls };
        }

        return { type: "assistant", content: fullText, toolCalls: [] };
    }

    async function executeToolCalls(toolCalls) {
        for (const tc of toolCalls) {
            const fn = tc.function || {};
            const name = fn.name;
            const rawArgs = fn.arguments || "{}";

            let args = {};
            try {
                args = JSON.parse(rawArgs);
            } catch {
                console.warn("Failed to parse tool arguments for", name, rawArgs);
            }

            if (name === "run_command") {
                const command = args.command || args.cmd || "";
                if (!command) continue;

                // Show the command in the chat for transparency.
                addMessage(`$ ${command}`, false);

                try {
                    const result = await runCommand(command);
                    const content = [
                        `Command: ${command}`,
                        `Exit code: ${result.exitCode}`,
                        "",
                        result.output || ""
                    ].join("\n");

                    messageHistory.push({
                        role: "tool",
                        tool_call_id: tc.id,
                        name: "run_command",
                        content
                    });
                } catch (err) {
                    const errorText = `run_command error: ${err?.message || String(err)}`;
                    messageHistory.push({
                        role: "tool",
                        tool_call_id: tc.id,
                        name: "run_command",
                        content: errorText
                    });
                }
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

