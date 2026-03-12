// Web Audio API for Retro Sounds
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol=0.1) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sounds = {
    catchHeart: () => {
        playTone(523.25, 'square', 0.1); 
        setTimeout(() => playTone(880.00, 'square', 0.15), 100); 
    },
    catchStar: () => {
        playTone(523.25, 'square', 0.1);
        setTimeout(() => playTone(659.25, 'square', 0.1), 100);
        setTimeout(() => playTone(783.99, 'square', 0.1), 200);
        setTimeout(() => playTone(1046.50, 'square', 0.2), 300);
    },
    bombHit: () => {
        playTone(150, 'sawtooth', 0.3, 0.2);
        setTimeout(() => playTone(100, 'sawtooth', 0.4, 0.2), 150);
    },
    win: () => {
        [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50, 1567.98].forEach((f, i) => {
            setTimeout(() => playTone(f, 'square', 0.2, 0.1), i * 150);
        });
    },
    start: () => {
        [440, 554.37, 659.25, 880].forEach((f, i) => {
            setTimeout(() => playTone(f, 'square', 0.15, 0.1), i * 100);
        });
    }
}

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    
    // Screens
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const winScreen = document.getElementById('win-screen');
    
    // UI Elements
    const scoreDisplay = document.getElementById('score-display');
    const btnRestart = document.getElementById('btn-restart');
    
    // Canvas Setup
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency on background
    
    // Game State
    let gameState = 'START'; // START, PLAYING, WIN
    
    // Default requirements
    const WIN_REQS = {
        HEART: 12,
        BOBA: 3,
        CHOCO: 8
    };
    
    let caught = { HEART: 0, BOBA: 0, CHOCO: 0 };
    let animationId;
    
    // Virtual resolution for pixel art feel
    const GAME_WIDTH = 320;
    const GAME_HEIGHT = 480;
    
    // Controls -> Changed to Drag/Touch instead of keys
    // We only need an internal target X
    let targetX = GAME_WIDTH / 2 - 20;

    // --- GAME OBJECTS ---
    
    const player = {
        x: GAME_WIDTH / 2 - 20,
        y: GAME_HEIGHT - 60,
        width: 40,
        height: 40,
        emoji: '🧺',
        bounceScale: 1, // For bounce animation
        
        draw(ctx) {
            ctx.save(); // Save context state
            
            // Translate to center of player for scaling
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.scale(this.bounceScale, this.bounceScale);
            
            ctx.font = '36px sans-serif'; 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.emoji, 0, 0); // Drawn at origin
            
            ctx.restore(); // Restore context state
        },
        
        update() {
            // Smoothly move player to targetX (lerp)
            this.x += (targetX - (this.x + this.width/2)) * 0.2;
            
            // Bounce recover
            if (this.bounceScale > 1) {
                this.bounceScale -= 0.05;
            } else if (this.bounceScale < 1) {
                this.bounceScale = 1;
            }
            
            // Bounds
            if (this.x < 0) this.x = 0;
            if (this.x + this.width > GAME_WIDTH) this.x = GAME_WIDTH - this.width;
        },
        
        bounce() {
            this.bounceScale = 1.4;
        }
    };
    
    let items = [];
    const ITEM_TYPES = ['HEART', 'BOBA', 'CHOCO', 'ROACH'];
    
    class FallingItem {
        constructor() {
            this.size = 20 + Math.random() * 10;
            this.x = Math.random() * (GAME_WIDTH - this.size);
            this.y = -this.size;
            
            // Determine type
            const rand = Math.random();
            if (rand < 0.6) this.type = 'HEART'; // 60% chance
            else if (rand < 0.75) this.type = 'BOBA'; // 15% chance
            else if (rand < 0.9) this.type = 'CHOCO'; // 15% chance
            else this.type = 'ROACH'; // 10% chance
            
            // Increase speed based on total caught
            const totalCaught = caught.HEART + caught.BOBA + caught.CHOCO;
            this.speed = 2 + Math.random() * 3 + (totalCaught * 0.05);
            
            this.colors = {
                'HEART': '#ff477e',
            };
            
            this.emojis = {
                'BOBA': '🧋',
                'CHOCO': '🍫',
                'ROACH': '🪳'
            };
        }
        
        draw(ctx) {
            if (this.type === 'HEART') {
                ctx.fillStyle = this.colors[this.type];
                ctx.shadowBlur = 5;
                ctx.shadowColor = this.colors[this.type];
                const x = this.x;
                const y = this.y + this.size * 0.1;
                const size = this.size * 0.9;
                ctx.beginPath();
                ctx.moveTo(x + size / 2, y + size / 4);
                ctx.bezierCurveTo(x + size, y, x + size, y + size / 2, x + size / 2, y + size);
                ctx.bezierCurveTo(x, y + size / 2, x, y, x + size / 2, y + size / 4);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else {
                ctx.font = `${this.size}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                // Rotate roach slightly for realism
                ctx.save();
                ctx.translate(this.x + this.size/2, this.y + this.size/2);
                if (this.type === 'ROACH') ctx.rotate(Math.PI / 4);
                ctx.fillText(this.emojis[this.type], 0, 0);
                ctx.restore();
            }
        }
        
        update() {
            this.y += this.speed;
        }
    }
    
    // --- FLOATING TEXT SYSTEM ---
    let floatingTexts = [];
    class FloatingText {
        constructor(x, y, text, color) {
            this.x = x;
            this.y = y;
            this.text = text;
            this.color = color;
            this.life = 1.0;
            this.velocityY = -2;
        }
        
        draw(ctx) {
            ctx.save();
            ctx.globalAlpha = this.life;
            ctx.fillStyle = this.color;
            ctx.font = 'bold 16px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            // adding small stroke for visibility
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.strokeText(this.text, this.x, this.y);
            ctx.fillText(this.text, this.x, this.y);
            ctx.restore();
        }
        
        update() {
            this.y += this.velocityY;
            this.life -= 0.03;
        }
    }

    // --- STAR FIELD BACKGROUND ---
    let stars = [];
    function initStars() {
        stars = [];
        for(let i=0; i<50; i++) {
            stars.push({
                x: Math.random() * GAME_WIDTH,
                y: Math.random() * GAME_HEIGHT,
                size: Math.random() * 2 + 1,
                blinkSpeed: Math.random() * 0.05 + 0.01,
                alpha: Math.random()
            });
        }
    }

    function drawStars(ctx, intensity) {
        // intensity is from 0.0 to 1.0 (based on game progress)
        if (intensity <= 0.1) return; // Only show when progress is substantial
        
        ctx.save();
        stars.forEach(star => {
            star.alpha += star.blinkSpeed;
            const currentAlpha = (Math.sin(star.alpha) * 0.5 + 0.5) * intensity;
            ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }
    
    // --- CONFETTI SYSTEM ---
    let particles = [];
    const colors = ['#ff477e', '#ffeb3b', '#00f0ff', '#ff7096', '#ffffff'];

    function createConfetti() {
        for (let i = 0; i < 150; i++) {
            particles.push({
                x: GAME_WIDTH / 2,
                y: GAME_HEIGHT / 2, // Start from center
                r: Math.random() * 6 + 2, // Radius
                dx: Math.random() * 10 - 5, // Velocity x
                dy: Math.random() * -10 - 2, // Velocity y (upwards)
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.floor(Math.random() * 10) - 10,
                tiltAngleIncrement: (Math.random() * 0.07) + 0.05,
                tiltAngle: 0
            });
        }
    }

    function drawConfetti(ctx) {
        particles.forEach(p => {
            ctx.beginPath();
            ctx.lineWidth = p.r;
            ctx.strokeStyle = p.color;
            ctx.moveTo(p.x + p.tilt + p.r, p.y);
            ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r);
            ctx.stroke();
        });
    }

    function updateConfetti() {
        particles.forEach((p, index) => {
            p.tiltAngle += p.tiltAngleIncrement;
            p.y += (Math.cos(p.tiltAngle) + 1 + p.r / 2) / 2;
            p.x += Math.sin(p.tiltAngle) * 2;
            p.dy += 0.1; // Gravity
            p.y += p.dy;

            // Remove particles that fall off screen
            if (p.x < -20 || p.x > GAME_WIDTH + 20 || p.y > GAME_HEIGHT + 20) {
               particles.splice(index, 1);
            }
        });
    }

    // --- MAIN FUNCTIONS ---
    
    function initGame() {
        caught = { HEART: 0, BOBA: 0, CHOCO: 0 };
        items = [];
        floatingTexts = [];
        particles = []; // Clear confetti
        player.x = GAME_WIDTH / 2 - player.width / 2;
        targetX = GAME_WIDTH / 2;
        initStars();
        updateScoreDisplay();
    }
    
    function startGame() {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        sounds.start();
        initGame();
        gameState = 'PLAYING';
        startScreen.classList.remove('active');
        winScreen.classList.remove('active');
        gameScreen.classList.add('active');
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        lastTime = performance.now();
        itemSpawnTimer = 0;
        
        requestAnimationFrame(gameLoop);
    }
    
    function typewriterEffect(element, text, speed, callback) {
        element.innerHTML = '';
        let i = 0;
        function type() {
            if (i < text.length) {
                // Handle basic HTML breaks
                if (text.substring(i, i+4) === '<br>') {
                    element.innerHTML += '<br>';
                    i += 4;
                } else {
                    element.innerHTML += text.charAt(i);
                    i++;
                }
                setTimeout(type, speed);
            } else if (callback) {
                callback();
            }
        }
        type();
    }

    function winGame() {
        gameState = 'WIN';
        gameScreen.classList.remove('active');
        winScreen.classList.add('active');
        window.removeEventListener('resize', resizeCanvas);
        
        gameScreen.classList.add('active'); // Keep game screen active for background canvas
        document.getElementById('ui-bar').style.display = 'none'; // hide UI
        
        createConfetti();
        
        // Typewriter Effect
        const msgBox = document.querySelector('.message-box');
        const typedText = `Selamat Ulang Tahun, Kekei sayang!<br><br>Semoga harimu dipenuhi kebahagiaan, senyum manis, dan cinta yang banyak.<br><br>Terima kasih sudah menangkap semua kenangan manis ini! Aku sayang kamu! 💕`;
        msgBox.innerHTML = ''; // Clear initial text
        
        btnRestart.style.display = 'none'; // Hide restart initially
        setTimeout(() => {
            typewriterEffect(msgBox, typedText, 50, () => {
                btnRestart.style.display = 'block'; // Show restart when done
            });
        }, 1000); // 1 second delay before typing starts
    }
    
    // Calculates overall progress 0.0 to 1.0 based on current catch / requirements
    function getProgress() {
        const pHeart = Math.min(caught.HEART / WIN_REQS.HEART, 1);
        const pBoba = Math.min(caught.BOBA / WIN_REQS.BOBA, 1);
        const pChoco = Math.min(caught.CHOCO / WIN_REQS.CHOCO, 1);
        return (pHeart + pBoba + pChoco) / 3.0; // Average of all three
    }
    
    function updateScoreDisplay() {
        scoreDisplay.innerHTML = `❤️ ${caught.HEART}/${WIN_REQS.HEART} &nbsp;|&nbsp; 🧋 ${caught.BOBA}/${WIN_REQS.BOBA} &nbsp;|&nbsp; 🍫 ${caught.CHOCO}/${WIN_REQS.CHOCO}`;
    }
    
    function resizeCanvas() {
        // We want to scale the canvas CSS while keeping its internal resolution constant
        const container = document.getElementById('game-container');
        const rect = container.getBoundingClientRect();
        
        // Match internal resolution
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
    }
    
    let lastTime = 0;
    let itemSpawnTimer = 0;
    const SPAWN_RATE = 700; // ms (slightly faster to account for more items required)
    
    function gameLoop(timestamp) {
        if (gameState !== 'PLAYING') return;
        
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;
        
        update(deltaTime);
        draw();
        
        animationId = requestAnimationFrame(gameLoop);
    }
    
    function update(deltaTime) {
        if (gameState === 'WIN') {
            updateConfetti();
            return; // Only update confetti if won
        }
        
        player.update();
        
        // Spawning logic
        itemSpawnTimer += deltaTime;
        if (itemSpawnTimer > SPAWN_RATE) {
            items.push(new FallingItem());
            itemSpawnTimer = 0;
        }
        
        // Item updating and collision
        for (let i = items.length - 1; i >= 0; i--) {
            let item = items[i];
            item.update();
            
            // Collision detection (AABB)
            if (item.y + item.size >= player.y && 
                item.x + item.size >= player.x && 
                item.x <= player.x + player.width &&
                item.y <= player.y + player.height) {
                
                // Hit!
                if (item.type === 'HEART' || item.type === 'BOBA' || item.type === 'CHOCO') {
                    // Only count up to the limit? No, let them catch more but it maxes at req for win check.
                    caught[item.type]++;
                    player.bounce();
                    
                    if (item.type === 'HEART') sounds.catchHeart();
                    else sounds.catchStar();
                    
                    // Floating text feedback
                    floatingTexts.push(new FloatingText(item.x + item.size/2, item.y, "+1", item.type === 'HEART' ? '#ff477e' : '#fff'));
                    
                } else if (item.type === 'ROACH') {
                    // Penalty! Remove random caught item
                    if (caught.HEART > 0) caught.HEART--;
                    else if (caught.CHOCO > 0) caught.CHOCO--;
                    else if (caught.BOBA > 0) caught.BOBA--;
                    
                    sounds.bombHit();
                    // Screen shake
                    const container = document.getElementById('game-container');
                    container.classList.remove('shake');
                    void container.offsetWidth; // trigger reflow
                    container.classList.add('shake');
                    
                    // Floating text feedback
                    floatingTexts.push(new FloatingText(item.x + item.size/2, item.y, "YAK!", "red"));
                    
                    // Visual feedback for bomb hit
                    container.style.boxShadow = '0 0 30px red';
                    setTimeout(() => container.style.boxShadow = '0 0 20px var(--primary)', 300);
                }
                
                updateScoreDisplay();
                items.splice(i, 1);
                
                // Check win condition
                if (caught.HEART >= WIN_REQS.HEART && caught.BOBA >= WIN_REQS.BOBA && caught.CHOCO >= WIN_REQS.CHOCO) {
                    sounds.win();
                    winGame();
                    return;
                }
                
            } else if (item.y > GAME_HEIGHT) {
                // Off screen
                items.splice(i, 1);
            }
        }
        
        // Update floating texts
        for(let i = floatingTexts.length - 1; i >= 0; i--) {
            floatingTexts[i].update();
            if(floatingTexts[i].life <= 0) {
                floatingTexts.splice(i, 1);
            }
        }
    }
    
    function draw() {
        // Calculate background color based on score
        const progress = Math.min(getProgress(), 1.0);
        
        // Night: rgb(45, 20, 69)
        // Dawn:  rgb(255, 158, 170) -- var(--accent)
        const r1 = 45, g1 = 20, b1 = 69;
        const r2 = 255, g2 = 158, b2 = 170;
        
        const currentR = Math.floor(r1 + (r2 - r1) * progress);
        const currentG = Math.floor(g1 + (g2 - g1) * progress);
        const currentB = Math.floor(b1 + (b2 - b1) * progress);
        
        // Clear background with dynamic color
        ctx.fillStyle = `rgb(${currentR}, ${currentG}, ${currentB})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        // Draw Stars
        drawStars(ctx, progress);
        
        // Draw grid for retro feel
        ctx.strokeStyle = 'rgba(255, 71, 126, 0.1)';
        ctx.lineWidth = 1;
        for(let i = 0; i < GAME_WIDTH; i += 20) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, GAME_HEIGHT); ctx.stroke();
        }
        for(let i = 0; i < GAME_HEIGHT; i += 20) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(GAME_WIDTH, i); ctx.stroke();
        }
        
        // Draw Player
        player.draw(ctx);
        
        // Draw Items if still playing
        if (gameState === 'PLAYING') {
            items.forEach(item => item.draw(ctx));
        }

        // Draw Floating Texts
        floatingTexts.forEach(ft => ft.draw(ctx));

        // Draw Confetti if won
        if (gameState === 'WIN') {
            drawConfetti(ctx);
        }
    }
    
    // --- INPUT HANDLING ---
    
    function setTargetX(clientX) {
        const rect = canvas.getBoundingClientRect();
        // Scale clientX to canvas internal resolution
        const scaleX = canvas.width / rect.width;
        targetX = (clientX - rect.left) * scaleX;
    }
    
    // Mouse / Touch Drag Support
    let isDragging = false;
    
    // Mouse Events
    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        setTargetX(e.clientX);
    });
    
    window.addEventListener('mousemove', (e) => {
        if (isDragging && gameState === 'PLAYING') {
            setTargetX(e.clientX);
        }
    });
    
    window.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    // Touch Events
    canvas.addEventListener('touchstart', (e) => {
        // e.preventDefault(); // allow default to handle taps sometimes, but prevent scrolling
        if(e.touches.length > 0) {
            setTargetX(e.touches[0].clientX);
        }
    }, { passive: false });
    
    window.addEventListener('touchmove', (e) => {
        if (gameState === 'PLAYING' && e.touches.length > 0) {
            setTargetX(e.touches[0].clientX);
        }
    }, { passive: false });
    
    // Start Interaction (Clicking anywhere on start screen)
    startScreen.addEventListener('click', startGame);
    
    // Restart Interaction
    btnRestart.addEventListener('click', () => {
        document.getElementById('ui-bar').style.display = 'block'; // re-show UI
        startGame();
    });

});
