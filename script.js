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
    },
    puff: () => { 
        playTone(200, 'noise', 0.2, 0.3); 
        playTone(100, 'sawtooth', 0.2, 0.2);
    }
}

// Wait for DOM
document.addEventListener('DOMContentLoaded', () => {
    
    // Screens
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    const winScreen = document.getElementById('win-screen');
    const letterScreen = document.getElementById('letter-screen');
    const cakeScreen = document.getElementById('cake-screen');
    const finalScreen = document.getElementById('final-screen');
    
    // UI Elements
    const scoreDisplay = document.getElementById('score-display');
    const btnRestart = document.getElementById('btn-restart');
    const btnNextLetter = document.getElementById('btn-next-letter');
    const envelope = document.getElementById('envelope');
    const envelopeInstruction = document.getElementById('envelope-instruction');
    const letterText = document.getElementById('letter-text');
    const btnNextCake = document.getElementById('btn-next-cake');
    const cakeContainer = document.getElementById('cake-container');
    const cakeInstruction = document.getElementById('cake-instruction');
    
    // Background Music
    const bgMusic = document.getElementById('bg-music');
    let fadeInterval = null;
    
    function playMusicWithFadeIn() {
        if (!bgMusic) return;
        
        bgMusic.volume = 0;
        bgMusic.play().then(() => {
            clearInterval(fadeInterval);
            fadeInterval = setInterval(() => {
                if (bgMusic.volume < 0.95) {
                    bgMusic.volume += 0.05;
                } else {
                    bgMusic.volume = 1.0;
                    clearInterval(fadeInterval);
                }
            }, 200); // increase volume every 200ms
        }).catch(e => console.log('Autoplay prevented or music file missing: ', e));
    }
    
    function stopMusic() {
        if (!bgMusic) return;
        clearInterval(fadeInterval);
        bgMusic.pause();
        bgMusic.currentTime = 0;
    }
    
    // Canvas Setup
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d', { alpha: false }); 
    
    // Game State
    let gameState = 'START'; // START, PLAYING, WIN, LETTER, CAKE, FINAL
    let animationId;
    
    // Default requirements
    const WIN_REQS = { HEART: 12, BOBA: 3, CHOCO: 8 };
    let caught = { HEART: 0, BOBA: 0, CHOCO: 0 };
    
    // Virtual resolution for pixel art feel
    const GAME_WIDTH = 320;
    const GAME_HEIGHT = 480;
    let targetX = GAME_WIDTH / 2 - 20;

    // --- GAME OBJECTS ---
    const player = {
        x: GAME_WIDTH / 2 - 20,
        y: GAME_HEIGHT - 60,
        width: 40,
        height: 40,
        emoji: '🧺',
        bounceScale: 1,
        update() {
            this.x += (targetX - (this.x + this.width/2)) * 0.2;
            if (this.bounceScale > 1) {
                this.bounceScale -= 0.05;
            } else if (this.bounceScale < 1) {
                this.bounceScale = 1;
            }
            if (this.x < 0) this.x = 0;
            if (this.x + this.width > GAME_WIDTH) this.x = GAME_WIDTH - this.width;
        },
        draw(ctx) {
            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.scale(this.bounceScale, this.bounceScale);
            ctx.font = '36px sans-serif'; 
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.emoji, 0, 0);
            ctx.restore();
        },
        bounce() {
            this.bounceScale = 1.4;
        }
    };
    
    let items = [];
    class FallingItem {
        constructor() {
            this.size = 20 + Math.random() * 10;
            this.x = Math.random() * (GAME_WIDTH - this.size);
            this.y = -this.size;
            
            const rand = Math.random();
            if (rand < 0.6) this.type = 'HEART';
            else if (rand < 0.75) this.type = 'BOBA';
            else if (rand < 0.9) this.type = 'CHOCO';
            else this.type = 'ROACH';
            
            const totalCaught = caught.HEART + caught.BOBA + caught.CHOCO;
            this.speed = 2 + Math.random() * 3 + (totalCaught * 0.05);
            
            this.colors = { 'HEART': '#ff477e' };
            this.emojis = { 'BOBA': '🧋', 'CHOCO': '🍫', 'ROACH': '🪳' };
        }
        update() { this.y += this.speed; }
        draw(ctx) {
            if (this.type === 'HEART') {
                ctx.fillStyle = this.colors[this.type];
                ctx.shadowBlur = 5;
                ctx.shadowColor = this.colors[this.type];
                const x = this.x, y = this.y + this.size * 0.1, size = this.size * 0.9;
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
                ctx.save();
                ctx.translate(this.x + this.size/2, this.y + this.size/2);
                if (this.type === 'ROACH') ctx.rotate(Math.PI / 4);
                ctx.fillText(this.emojis[this.type], 0, 0);
                ctx.restore();
            }
        }
    }
    
    let floatingTexts = [];
    class FloatingText {
        constructor(x, y, text, color) {
            this.x = x; this.y = y; this.text = text; this.color = color;
            this.life = 1.0; this.velocityY = -2;
        }
        update() { this.y += this.velocityY; this.life -= 0.03; }
        draw(ctx) {
            ctx.save();
            ctx.globalAlpha = this.life;
            ctx.fillStyle = this.color;
            ctx.font = 'bold 16px "Press Start 2P", monospace';
            ctx.textAlign = 'center';
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.strokeText(this.text, this.x, this.y);
            ctx.fillText(this.text, this.x, this.y);
            ctx.restore();
        }
    }

    let stars = [];
    function initStars() {
        stars = [];
        for(let i=0; i<50; i++) {
            stars.push({
                x: Math.random() * GAME_WIDTH, y: Math.random() * GAME_HEIGHT,
                size: Math.random() * 2 + 1, blinkSpeed: Math.random() * 0.05 + 0.01,
                alpha: Math.random()
            });
        }
    }
    function drawStars(ctx, intensity) {
        if (intensity <= 0.1) return;
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
    
    let particles = [];
    const colors = ['#ff477e', '#ffeb3b', '#00f0ff', '#ff7096', '#ffffff'];
    function createConfetti() {
        for (let i = 0; i < 150; i++) {
            particles.push({
                x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2,
                r: Math.random() * 6 + 2, dx: Math.random() * 10 - 5, dy: Math.random() * -10 - 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                tilt: Math.floor(Math.random() * 10) - 10, tiltAngleIncrement: (Math.random() * 0.07) + 0.05, tiltAngle: 0
            });
        }
    }
    function updateConfetti() {
        particles.forEach((p, index) => {
            p.tiltAngle += p.tiltAngleIncrement;
            p.y += (Math.cos(p.tiltAngle) + 1 + p.r / 2) / 2;
            p.x += Math.sin(p.tiltAngle) * 2;
            p.dy += 0.1;
            p.y += p.dy;
            if (p.x < -20 || p.x > GAME_WIDTH + 20 || p.y > GAME_HEIGHT + 20) {
               particles.splice(index, 1);
            }
        });
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

    // --- MAIN GAME LOGIC ---
    
    function initGame() {
        caught = { HEART: 0, BOBA: 0, CHOCO: 0 };
        items = []; floatingTexts = []; particles = [];
        player.x = GAME_WIDTH / 2 - player.width / 2;
        targetX = GAME_WIDTH / 2;
        initStars();
        updateScoreDisplay();
        
        // Reset Screens and UI
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        btnNextLetter.style.display = 'none';
        btnNextCake.style.display = 'none';
        envelope.classList.remove('open');
        letterText.innerHTML = '';
        envelopeInstruction.style.display = 'block';
        
        // Reset Cake
        blowCount = 0;
        document.querySelectorAll('.flame').forEach(f => {
            f.classList.remove('off');
            f.style.opacity = '1';
        });
        cakeInstruction.innerHTML = "Ketuk kue berkali-kali<br>untuk meniup lilinnya!";
    }
    
    function startGame() {
        if(audioCtx.state === 'suspended') audioCtx.resume();
        sounds.start();
        
        // Start playing our background music!
        playMusicWithFadeIn();
        
        initGame();
        gameState = 'PLAYING';
        startScreen.classList.remove('active');
        gameScreen.classList.add('active'); 
        document.getElementById('ui-bar').style.display = 'block';
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        lastTime = performance.now();
        itemSpawnTimer = 0;
        if (!animationId) {
            requestAnimationFrame(gameLoop);
        }
    }
    
    function typewriterEffect(element, text, speed, callback) {
        element.innerHTML = '';
        let i = 0;
        function type() {
            if (i < text.length) {
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
        document.getElementById('ui-bar').style.display = 'none';
        winScreen.classList.add('active');
        
        createConfetti(); // Fire once for game win
        
        setTimeout(() => {
            btnNextLetter.style.display = 'block';
        }, 1500);
    }
    
    function showLetterScreen() {
        gameState = 'LETTER';
        winScreen.classList.remove('active');
        letterScreen.classList.add('active');
    }
    
    // Envelope Logic
    envelope.addEventListener('click', () => {
        if (!envelope.classList.contains('open')) {
            envelope.classList.add('open');
            envelopeInstruction.style.display = 'none';
            sounds.start(); // sweet sound
            
            setTimeout(() => {
                const message = "Hi Kekei manis,<br><br>Terima kasih sudah hadir ke dunia ini dan menjadi bagian penting dalam hidupku.<br><br>Setiap senyummu sukses membuat hariku jauh lebih cerah.<br><br>Aku sayang kamu! 💕";
                typewriterEffect(letterText, message, 50, () => {
                    btnNextCake.style.display = 'block';
                });
            }, 1200); // delay for flap opening and paper sliding
        }
    });

    function showCakeScreen() {
        gameState = 'CAKE';
        letterScreen.classList.remove('active');
        cakeScreen.classList.add('active');
    }

    // Cake / Blow Candle Logic
    let blowCount = 0;
    const MAX_BLOW = 6;
    cakeContainer.addEventListener('click', () => {
        if (gameState !== 'CAKE' || blowCount >= MAX_BLOW) return;
        
        blowCount++;
        sounds.puff();
        
        const flames = document.querySelectorAll('.flame');
        const intensity = 1 - (blowCount / MAX_BLOW);
        flames.forEach(f => f.style.opacity = intensity * 0.8 + 0.2); 
        
        if (blowCount >= MAX_BLOW) {
            flames.forEach(f => f.classList.add('off'));
            cakeInstruction.innerHTML = "Yeayyy! Selamat ulang tahun!";
            cakeInstruction.classList.remove('blink');
            sounds.win();
            
            setTimeout(() => {
                showFinalScreen();
            }, 2000);
        }
    });

    function showFinalScreen() {
        gameState = 'FINAL';
        cakeScreen.classList.remove('active');
        finalScreen.classList.add('active');
        
        createConfetti(); 
        document.getElementById('ui-bar').style.display = 'none';
    }
    
    function getProgress() {
        if (gameState !== 'PLAYING' && gameState !== 'START') return 1.0;
        const pHeart = Math.min(caught.HEART / WIN_REQS.HEART, 1);
        const pBoba = Math.min(caught.BOBA / WIN_REQS.BOBA, 1);
        const pChoco = Math.min(caught.CHOCO / WIN_REQS.CHOCO, 1);
        return (pHeart + pBoba + pChoco) / 3.0; // Average
    }
    
    function updateScoreDisplay() {
        scoreDisplay.innerHTML = `❤️ ${caught.HEART}/${WIN_REQS.HEART} &nbsp;|&nbsp; 🧋 ${caught.BOBA}/${WIN_REQS.BOBA} &nbsp;|&nbsp; 🍫 ${caught.CHOCO}/${WIN_REQS.CHOCO}`;
    }
    
    function resizeCanvas() {
        const container = document.getElementById('game-container');
        canvas.width = GAME_WIDTH;
        canvas.height = GAME_HEIGHT;
    }
    
    let lastTime = 0;
    let itemSpawnTimer = 0;
    const SPAWN_RATE = 700;
    
    function gameLoop(timestamp) {
        if (gameState === 'START') {
            lastTime = timestamp;
            animationId = requestAnimationFrame(gameLoop);
            return;
        }
        
        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;
        update(deltaTime);
        draw();
        
        animationId = requestAnimationFrame(gameLoop);
    }
    
    function update(deltaTime) {
        if (['WIN', 'LETTER', 'CAKE', 'FINAL'].includes(gameState)) {
            updateConfetti();
        }

        if (gameState === 'PLAYING') {
            player.update();
            itemSpawnTimer += deltaTime;
            if (itemSpawnTimer > SPAWN_RATE) {
                items.push(new FallingItem());
                itemSpawnTimer = 0;
            }
            
            for (let i = items.length - 1; i >= 0; i--) {
                let item = items[i];
                item.update();
                
                if (item.y + item.size >= player.y && 
                    item.x + item.size >= player.x && 
                    item.x <= player.x + player.width &&
                    item.y <= player.y + player.height) {
                    
                    if (item.type === 'HEART' || item.type === 'BOBA' || item.type === 'CHOCO') {
                        caught[item.type]++;
                        player.bounce();
                        
                        if (item.type === 'HEART') sounds.catchHeart();
                        else sounds.catchStar();
                        
                        floatingTexts.push(new FloatingText(item.x + item.size/2, item.y, "+1", item.type === 'HEART' ? '#ff477e' : '#fff'));
                        
                    } else if (item.type === 'ROACH') {
                        if (caught.HEART > 0) caught.HEART--;
                        else if (caught.CHOCO > 0) caught.CHOCO--;
                        else if (caught.BOBA > 0) caught.BOBA--;
                        
                        sounds.bombHit();
                        const container = document.getElementById('game-container');
                        container.classList.remove('shake');
                        void container.offsetWidth; 
                        container.classList.add('shake');
                        
                        floatingTexts.push(new FloatingText(item.x + item.size/2, item.y, "YAK!", "red"));
                        container.style.boxShadow = '0 0 30px red';
                        setTimeout(() => container.style.boxShadow = '0 0 20px var(--primary)', 300);
                    }
                    
                    updateScoreDisplay();
                    items.splice(i, 1);
                    
                    if (caught.HEART >= WIN_REQS.HEART && caught.BOBA >= WIN_REQS.BOBA && caught.CHOCO >= WIN_REQS.CHOCO) {
                        sounds.win();
                        winGame();
                    }
                    
                } else if (item.y > GAME_HEIGHT) {
                    items.splice(i, 1);
                }
            }
            
            for(let i = floatingTexts.length - 1; i >= 0; i--) {
                floatingTexts[i].update();
                if(floatingTexts[i].life <= 0) {
                    floatingTexts.splice(i, 1);
                }
            }
        }
    }
    
    function draw() {
        const progress = Math.min(getProgress(), 1.0);
        
        const currentR = Math.floor(45 + (255 - 45) * progress);
        const currentG = Math.floor(20 + (158 - 20) * progress);
        const currentB = Math.floor(69 + (170 - 69) * progress);
        
        ctx.fillStyle = `rgb(${currentR}, ${currentG}, ${currentB})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        
        drawStars(ctx, progress);
        
        ctx.strokeStyle = 'rgba(255, 71, 126, 0.1)';
        ctx.lineWidth = 1;
        for(let i = 0; i < GAME_WIDTH; i += 20) {
            ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, GAME_HEIGHT); ctx.stroke();
        }
        for(let i = 0; i < GAME_HEIGHT; i += 20) {
            ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(GAME_WIDTH, i); ctx.stroke();
        }
        
        if (gameState === 'PLAYING') {
            player.draw(ctx);
            items.forEach(item => item.draw(ctx));
            floatingTexts.forEach(ft => ft.draw(ctx));
        }

        if (['WIN', 'LETTER', 'CAKE', 'FINAL'].includes(gameState)) {
            drawConfetti(ctx);
        }
    }
    
    // --- INPUT HANDLING ---
    function setTargetX(clientX) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        targetX = (clientX - rect.left) * scaleX;
    }
    
    let isDragging = false;
    canvas.addEventListener('mousedown', (e) => { isDragging = true; setTargetX(e.clientX); });
    window.addEventListener('mousemove', (e) => { if (isDragging && gameState === 'PLAYING') setTargetX(e.clientX); });
    window.addEventListener('mouseup', () => { isDragging = false; });
    
    canvas.addEventListener('touchstart', (e) => { if(e.touches.length > 0) setTargetX(e.touches[0].clientX); }, { passive: false });
    window.addEventListener('touchmove', (e) => { if (gameState === 'PLAYING' && e.touches.length > 0) setTargetX(e.touches[0].clientX); }, { passive: false });
    
    startScreen.addEventListener('click', startGame);
    
    btnRestart.addEventListener('click', () => {
        stopMusic();
        finalScreen.classList.remove('active');
        document.getElementById('ui-bar').style.display = 'block';
        startGame();
    });
    
    btnNextLetter.addEventListener('click', showLetterScreen);
    btnNextCake.addEventListener('click', showCakeScreen);

    // --- DEVELOPER CHEATS ---
    window.addEventListener('keydown', (e) => {
        if (gameState === 'PLAYING' && (e.key === 'w' || e.key === 'W')) {
            console.log('Cheat activated: Instant Win');
            // Max out requirements
            caught.HEART = WIN_REQS.HEART;
            caught.BOBA = WIN_REQS.BOBA;
            caught.CHOCO = WIN_REQS.CHOCO;
            updateScoreDisplay();
            sounds.win();
            winGame();
        }
    });

    // Initial draw to show the background color
    requestAnimationFrame((timestamp) => {
        lastTime = timestamp;
        gameLoop(timestamp);
    });
});
