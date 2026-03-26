class ChatWidget {
    constructor() {
        window.__logs = [];
        const originalLog = console.log;
        console.log = (...args) => {
            window.__logs.push(args.join(' '));
            originalLog.apply(console, args);
        };
        const originalError = console.error;
        console.error = (...args) => {
            window.__logs.push("ERROR: " + args.join(' '));
            originalError.apply(console, args);
        };

        this.container = document.getElementById('chat-widget-container');
        this.isOpen = false;
        this.history = []; // Store conversation history
        this.init();
    }

    init() {
        this.render();
        this.attachEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="chat-widget">
                <!-- Chat Window -->
                <div class="chat-window" id="chat-window">
                    <div class="chat-header">
                        <div class="flex items-center gap-sm">
                            <i class="fa-solid fa-robot"></i>
                            <div>
                                <h4>Panadería Paty AI</h4>
                                <span class="status-dot"></span> Online
                            </div>
                        </div>
                        <button id="close-chat" class="btn-icon"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="chat-messages" id="chat-messages">
                        <div class="message bot">
                            <p>¡Hola! 🥖 Bienvenido a Panadería Paty. Soy tu asistente personal. ¿Te gustaría saber qué acaba de salir del horno o buscas algo saludable hoy?</p>
                        </div>
                    </div>
                    <div class="chat-input-area">
                        <input type="text" id="chat-input" placeholder="Escribe tu mensaje...">
                        <button id="send-btn"><i class="fa-solid fa-paper-plane"></i></button>
                    </div>
                </div>

                <!-- Toggle Button -->
                <button class="chat-toggle-btn" id="chat-toggle">
                    <i class="fa-solid fa-message"></i>
                </button>
            </div>
        `;

        // Append styles dynamically
        const style = document.createElement('style');
        style.textContent = `
            .chat-widget {
                position: fixed;
                bottom: 2rem;
                right: 2rem;
                z-index: 2000;
                font-family: var(--font-body);
            }
            .chat-toggle-btn {
                background-color: var(--color-primary);
                color: #fff;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                box-shadow: var(--shadow-floating);
                transition: var(--transition-base);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .chat-toggle-btn:hover {
                transform: scale(1.1);
                background-color: var(--color-primary-light);
            }
            .chat-window {
                position: absolute;
                bottom: 80px;
                right: 0;
                width: 350px;
                height: 500px;
                background: #fff;
                border-radius: var(--border-radius-md);
                box-shadow: var(--shadow-floating);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                opacity: 0;
                transform: translateY(20px);
                pointer-events: none;
                transition: all 0.3s ease;
            }
            .chat-window.open {
                opacity: 1;
                transform: translateY(0);
                pointer-events: all;
            }
            .chat-header {
                background: var(--color-primary);
                color: #fff;
                padding: 1rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .btn-icon {
                background: none;
                border: none;
                color: #fff;
                cursor: pointer;
                font-size: 1.2rem;
            }
            .status-dot {
                display: inline-block;
                width: 8px;
                height: 8px;
                background-color: var(--color-success);
                border-radius: 50%;
                margin-right: 4px;
            }
            .chat-messages {
                flex: 1;
                padding: 1rem;
                overflow-y: auto;
                background-color: var(--color-surface-alt);
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .message {
                max-width: 80%;
                padding: 0.8rem;
                border-radius: 12px;
                font-size: 0.95rem;
                line-height: 1.4;
            }
            .message.bot {
                background: #fff;
                align-self: flex-start;
                border-bottom-left-radius: 2px;
                box-shadow: var(--shadow-sm);
            }
            .message.user {
                background: var(--color-accent);
                color: #fff;
                align-self: flex-end;
                border-bottom-right-radius: 2px;
            }
            .chat-input-area {
                padding: 1rem;
                background: #fff;
                border-top: 1px solid rgba(0,0,0,0.05);
                display: flex;
                gap: 0.5rem;
            }
            .chat-input-area input {
                flex: 1;
                padding: 0.8rem;
                border: 1px solid #ddd;
                border-radius: 20px;
                outline: none;
                font-family: inherit;
                font-size: 1.1rem; /* Mayor accesibilidad visual */
            }
            .chat-input-area input::placeholder {
                font-size: 1.1rem;
                color: #555; /* Mayor contraste */
            }
            .chat-input-area input:focus {
                border-color: var(--color-primary);
            }
            .chat-input-area button {
                background: var(--color-primary);
                color: #fff;
                border: none;
                width: 40px;
                height: 40px;
                border-radius: 50%;
                cursor: pointer;
                transition: 0.2s;
            }
            .chat-input-area button:hover {
                background: var(--color-primary-light);
            }
        `;
        document.head.appendChild(style);
    }

    attachEvents() {
        const toggleBtn = document.getElementById('chat-toggle');
        const closeBtn = document.getElementById('close-chat');
        const chatWindow = document.getElementById('chat-window');
        const sendBtn = document.getElementById('send-btn');
        const input = document.getElementById('chat-input');

        const toggleChat = () => {
            this.isOpen = !this.isOpen;
            chatWindow.classList.toggle('open', this.isOpen);
        };

        toggleBtn.addEventListener('click', toggleChat);
        closeBtn.addEventListener('click', toggleChat);

        const sendMessage = async () => {
            const text = input.value.trim();
            if (!text) return;

            // Add user message to UI
            this.addMessage(text, 'user');
            input.value = '';

            // Update History
            this.history.push({ role: "user", content: text });

            // Show loading state
            const loadingId = this.addMessage("...", 'bot', true);

            try {
                const response = await fetch('http://localhost:8000/chat', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: text,
                        history: this.history // Send full history
                    })
                });

                if (!response.ok) throw new Error('Network response was not ok');

                const data = await response.json();

                // Remove loading message
                this.removeMessage(loadingId);

                // Process Response for Tags
                let finalText = data.response;

                // Check for [SYNC_CART] tags
                const syncCartRegex = /\[SYNC_CART\]([\s\S]*?)\[\/SYNC_CART\]/g;
                let syncMatch;
                while ((syncMatch = syncCartRegex.exec(finalText)) !== null) {
                    try {
                        const cartItems = JSON.parse(syncMatch[1]);
                        this.syncCart(cartItems);
                    } catch (e) {
                        console.error("Error parsing sync cart data", e);
                        this.addMessage("DEBUG: Error parsing cart data", 'bot');
                    }
                }

                // Clean tags from display text
                finalText = finalText.replace(/\[SYNC_CART\][\s\S]*?\[\/SYNC_CART\]/g, '');

                // Add bot message
                if (finalText.trim()) {
                    this.addMessage(finalText, 'bot');
                    // CRITICAL FIX: Save the RAW response (with tags) to history
                    // so the AI remembers what it put in the cart.
                    this.history.push({ role: "assistant", content: data.response });
                }

            } catch (error) {
                console.error('Error:', error);
                this.removeMessage(loadingId);
                this.addMessage("Lo siento, tuve un problema de conexión.", 'bot');
            }
        };

        sendBtn.addEventListener('click', sendMessage);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    addMessage(text, sender, isLoading = false) {
        const messagesContainer = document.getElementById('chat-messages');
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        if (isLoading) msgDiv.id = `msg-${Date.now()}`;

        // Convert URLs to links if simple text
        // (Skipping for now to keep it simple)
        msgDiv.innerHTML = `<p>${text}</p>`;

        // Handling Markdown-ish newlines
        msgDiv.querySelector('p').style.whiteSpace = 'pre-line';

        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return msgDiv.id;
    }

    removeMessage(id) {
        const msg = document.getElementById(id);
        if (msg) msg.remove();
    }

    // --- CART SYNCHRONIZATION LOGIC ---

    syncCart(items) {
        console.log("Syncing Cart with:", items);

        let cartContainer = document.getElementById('shopping-cart-panel');
        if (!cartContainer) {
            this.createCartUI();
            cartContainer = document.getElementById('shopping-cart-panel');
        }

        const cartItemsContainer = cartContainer.querySelector('.cart-items');
        cartItemsContainer.innerHTML = ''; // Clear existing items used to accumulate drift

        let newTotal = 0;

        items.forEach(item => {
            const itemName = (item.item || '').trim();
            const itemPrice = parseFloat(item.price) || 0;
            const quantity = parseInt(item.quantity) || 1;

            const itemEl = document.createElement('div');
            itemEl.className = 'cart-item';
            // Store data for potential local interactions if needed
            itemEl.dataset.itemName = itemName;
            itemEl.dataset.itemPrice = itemPrice;
            itemEl.dataset.quantity = quantity;

            // Format: "2x Item Name"
            const qtyDisplay = quantity > 1 ?
                `<span class="item-qty" style="font-weight:bold; margin-right:5px;">${quantity}x </span>` :
                '<span class="item-qty" style="font-weight:bold; margin-right:5px; display:none;">1x </span>';

            itemEl.innerHTML = `
                <div style="flex-grow:1;">
                    ${qtyDisplay}
                    <span class="item-name">${itemName}</span>
                </div>
                <span>$${itemPrice.toFixed(2)}</span>
            `;
            cartItemsContainer.appendChild(itemEl);

            newTotal += itemPrice * quantity;
        });

        this.updateTotal(newTotal);

        // Show/Hide cart based on items
        if (items.length > 0) {
            cartContainer.classList.add('visible');
        } else {
            // Optional: Hide cart if empty? Or keep visible with 0 total.
            // cartContainer.classList.remove('visible');
        }
    }

    updateTotal(totalAmount) {
        let totalEl = document.getElementById('cart-total-value');
        if (totalEl) {
            totalEl.innerText = totalAmount.toFixed(2);
        }
    }

    createCartUI() {
        const cartDiv = document.createElement('div');
        cartDiv.id = 'shopping-cart-panel';
        cartDiv.innerHTML = `
            <div class="cart-header">
                <h3><i class="fa-solid fa-basket-shopping"></i> Tu Pedido</h3>
            </div>
            <div class="cart-items"></div>
            <div class="cart-total">Total estimado: $<span id="cart-total-value">0.00</span></div>
        `;
        document.body.appendChild(cartDiv);

        // Add styles dynamically (if not in CSS)
        Object.assign(cartDiv.style, {
            position: 'fixed',
            bottom: '100px',
            left: '20px',
            width: '300px',
            background: 'white',
            borderRadius: '10px',
            boxShadow: '0 5px 20px rgba(0,0,0,0.15)',
            padding: '15px',
            zIndex: '1999',
            fontFamily: 'var(--font-body)',
            display: 'none', // Default hidden
            flexDirection: 'column',
            gap: '10px'
        });

        // Add class logic for visibility
        // We add a style rule for .visible because inline display:none overrides class
        const style = document.createElement('style');
        style.textContent = `
            #shopping-cart-panel.visible {
                display: flex !important;
                animation: slideIn 0.3s ease-out;
            }
            .cart-header h3 { margin: 0; font-size: 1.1rem; color: var(--color-primary); }
            .cart-items {
                max-height: 250px;
                overflow-y: auto;
                padding-right: 5px;
            }
            .cart-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #eee;
                font-size: 0.95rem;
            }
            .cart-total {
                margin-top: 10px;
                font-weight: bold;
                text-align: right;
                font-size: 1.1rem;
                color: var(--color-secondary);
            }
            @keyframes slideIn {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    new ChatWidget();
});
