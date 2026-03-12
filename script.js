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
    const WIN_SCORE = 20;
    let score = 0;
    let animationId;
    
    // Virtual resolution for pixel art feel
    const GAME_WIDTH = 320;
    const GAME_HEIGHT = 480;
    
    // Controls
    const keys = {
        left: false,
        right: false
    };

    // --- GAME OBJECTS ---
    
    const player = {
        x: GAME_WIDTH / 2 - 20,
        y: GAME_HEIGHT - 50,
        width: 40,
        height: 40, // Made slightly bigger for emoji
        speed: 5,
        emoji: '🧺', // Cute picnic basket!
        
        draw(ctx) {
            ctx.font = '36px sans-serif'; // Use system font for emoji
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // Draw emoji centered in the hit box
            ctx.fillText(this.emoji, this.x + this.width/2, this.y + this.height/2);
            
            // Optional: Draw debug hitbox
            // ctx.strokeStyle = 'red';
            // ctx.strokeRect(this.x, this.y, this.width, this.height);
        },
        
        update() {
            if (keys.left) this.x -= this.speed;
            if (keys.right) this.x += this.speed;
            
            // Bounds
            if (this.x < 0) this.x = 0;
            if (this.x + this.width > GAME_WIDTH) this.x = GAME_WIDTH - this.width;
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
            
            this.speed = 2 + Math.random() * 3 + (score * 0.1);
            
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
        score = 0;
        items = [];
        particles = []; // Clear confetti
        player.x = GAME_WIDTH / 2 - player.width / 2;
        updateScoreDisplay();
        keys.left = false;
        keys.right = false;
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
        
        // Start Confetti Effect on Win Screen canvas if we had one, 
        // but since it's DOM, let's keep drawing it on the game-canvas and just overlay the win screen
        // So we don't hide the game canvas!
        gameScreen.classList.add('active'); // Keep game screen active for background canvas
        document.getElementById('ui-bar').style.display = 'none'; // hide UI
        document.getElementById('mobile-controls').style.display = 'none'; // hide controls
        
        createConfetti();
        
        // Typewriter Effect
        const msgBox = document.querySelector('.message-box');
        const typedText = `Selamat Ulang Tahun, Kekei sayang!<br><br>Semoga harimu dipenuhi kebahagiaan, senyum manis, dan cinta yang banyak.<br><br>Sama seperti langit yang mencerah, kamu selalu mencerahkan hariku. Terima kasih sudah menangkap semua hatiku! Aku sayang kamu! 💕`;
        msgBox.innerHTML = ''; // Clear initial text
        
        btnRestart.style.display = 'none'; // Hide restart initially
        setTimeout(() => {
            typewriterEffect(msgBox, typedText, 50, () => {
                btnRestart.style.display = 'block'; // Show restart when done
            });
        }, 1000); // 1 second delay before typing starts
    }
    
    function updateScoreDisplay() {
        scoreDisplay.textContent = `Hati: ${score}/${WIN_SCORE}`;
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
    const SPAWN_RATE = 800; // ms
    
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
                if (item.type === 'HEART') {
                    score += 1;
                    sounds.catchHeart();
                } else if (item.type === 'BOBA' || item.type === 'CHOCO') {
                    score += 2;
                    sounds.catchStar();
                } else if (item.type === 'ROACH') {
                    score = Math.max(0, score - 3); // Lose score but don't go below 0
                    sounds.bombHit();
                    // Visual feedback for bomb hit
                    document.getElementById('game-container').style.boxShadow = '0 0 30px red';
                    setTimeout(() => document.getElementById('game-container').style.boxShadow = '0 0 20px var(--primary)', 300);
                }
                
                updateScoreDisplay();
                items.splice(i, 1);
                
                // Check win condition
                if (score >= WIN_SCORE) {
                    sounds.win();
                    winGame();
                    return;
                }
                
            } else if (item.y > GAME_HEIGHT) {
                // Off screen
                items.splice(i, 1);
            }
        }
    }
    
    function draw() {
        // Calculate background color based on score
        // From dark purple to sunrise pink
        const progress = Math.min(score / WIN_SCORE, 1);
        
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

        // Draw Confetti if won
        if (gameState === 'WIN') {
            drawConfetti(ctx);
        }
    }
    
    // --- INPUT HANDLING ---
    
    // Keyboard
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
        if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    });
    
    window.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
    });
    
    // Mobile Touch Buttons
    const btnLeft = document.getElementById('btn-left');
    const btnRight = document.getElementById('btn-right');
    
    btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys.left = true; });
    btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys.left = false; });
    
    btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys.right = true; });
    btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys.right = false; });
    
    // Start Interaction (Clicking anywhere on start screen)
    startScreen.addEventListener('click', startGame);
    
    // Restart Interaction
    btnRestart.addEventListener('click', startGame);

});
