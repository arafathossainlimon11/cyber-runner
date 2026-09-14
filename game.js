// Main Game Engine
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State Constants
const STATE_START = 'START';
const STATE_PLAYING = 'PLAYING';
const STATE_PAUSED = 'PAUSED';
const STATE_GAMEOVER = 'GAMEOVER';

let gameState = STATE_START;

// Canvas Scaling setup
function resizeCanvas() {
    canvas.width = 800;
    canvas.height = 450;
}
resizeCanvas();

// Global Variables
let gameSpeed = 5;
let baseSpeed = 5;
let distance = 0;
let score = 0;
let highScore = parseInt(localStorage.getItem('cyber_runner_highscore')) || 0;
let frameCount = 0;

// Environment / Day-Night Cycle
let timeOfDay = 0; // 0 to 1

// UI Elements
const distVal = document.getElementById('distVal');
const scoreVal = document.getElementById('scoreVal');
const highVal = document.getElementById('highVal');
const activePowerup = document.getElementById('activePowerup');
const startScreen = document.getElementById('startScreen');
const pauseScreen = document.getElementById('pauseScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const hud = document.getElementById('hud');

// Control Buttons
document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('restartPauseBtn').addEventListener('click', startGame);
document.getElementById('pauseBtn').addEventListener('click', togglePause);
document.getElementById('resumeBtn').addEventListener('click', togglePause);

const soundBtn = document.getElementById('soundToggleBtn');
soundBtn.addEventListener('click', () => {
    soundManager.init();
    const muted = soundManager.toggleMute();
    soundBtn.innerText = muted ? "সাউন্ড: অফ" : "সাউন্ড: অন";
});

// Ground Level
const groundY = 370;

// Fictional Runner Character Object
const player = {
    x: 100,
    y: groundY - 50,
    width: 35,
    height: 50,
    velocityY: 0,
    gravity: 0.65,
    jumpForce: -12.5,
    isGrounded: false,
    jumpCount: 0,
    maxJumps: 2,
    isSliding: false,
    slideTimer: 0,
    shieldActive: false,
    shieldTimer: 0,
    speedBoostActive: false,
    speedBoostTimer: 0,
    animFrame: 0,

    reset() {
        this.y = groundY - 50;
        this.height = 50;
        this.velocityY = 0;
        this.isGrounded = true;
        this.jumpCount = 0;
        this.isSliding = false;
        this.shieldActive = false;
        this.speedBoostActive = false;
    },

    jump() {
        if (this.jumpCount < this.maxJumps) {
            this.velocityY = this.jumpForce;
            this.isGrounded = false;
            this.jumpCount++;
            this.isSliding = false;
            this.height = 50;
            soundManager.playJump();
            createParticles(this.x + 10, this.y + 40, '#00f2fe', 8);
        }
    },

    slide() {
        if (this.isGrounded && !this.isSliding) {
            this.isSliding = true;
            this.height = 25;
            this.y = groundY - 25;
            this.slideTimer = 45; // Frames for slide duration
        }
    },

    update() {
        // Physics logic
        this.velocityY += this.gravity;
        this.y += this.velocityY;

        if (this.y + this.height >= groundY) {
            this.y = groundY - this.height;
            this.velocityY = 0;
            this.isGrounded = true;
            this.jumpCount = 0;
        }

        // Slide Timer
        if (this.isSliding) {
            this.slideTimer--;
            if (this.slideTimer <= 0) {
                this.isSliding = false;
                this.height = 50;
                this.y = groundY - 50;
            }
        }

        // Power-ups Timers
        if (this.shieldActive) {
            this.shieldTimer--;
            if (this.shieldTimer <= 0) this.shieldActive = false;
        }

        if (this.speedBoostActive) {
            this.speedBoostTimer--;
            if (this.speedBoostTimer <= 0) {
                this.speedBoostActive = false;
                gameSpeed = baseSpeed;
            }
        }

        this.animFrame += 0.2;
    },

    draw() {
        ctx.save();
        
        // Speed Trail Effect
        if (this.speedBoostActive) {
            ctx.fillStyle = 'rgba(255, 234, 0, 0.3)';
            ctx.fillRect(this.x - 15, this.y, this.width, this.height);
        }

        // Shield Aura Effect
        if (this.shieldActive) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, 32, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw Fictional Cyber Runner Character
        ctx.fillStyle = '#38bdf8'; // Cyan Body
        if (this.isSliding) {
            // Sliding pose
            ctx.fillRect(this.x, this.y, this.width + 10, this.height);
            // Visor
            ctx.fillStyle = '#ff0055';
            ctx.fillRect(this.x + 25, this.y + 4, 10, 6);
        } else {
            // Standing/Running pose
            ctx.fillRect(this.x + 5, this.y + 12, 25, 25); // Torso
            // Visor / Head
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(this.x + 8, this.y, 20, 14);
            ctx.fillStyle = '#ff0055';
            ctx.fillRect(this.x + 18, this.y + 3, 10, 5);

            // Animated Running Legs
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 4;
            let legOffset = Math.sin(this.animFrame) * 12;
            
            ctx.beginPath();
            // Left Leg
            ctx.moveTo(this.x + 12, this.y + 37);
            ctx.lineTo(this.x + 12 - legOffset, this.y + 50);
            // Right Leg
            ctx.moveTo(this.x + 24, this.y + 37);
            ctx.lineTo(this.x + 24 + legOffset, this.y + 50);
            ctx.stroke();
        }

        ctx.restore();
    }
};

// Arrays for Dynamic Entities
let obstacles = [];
let coins = [];
let powerups = [];
let particles = [];

// Classes for Obstacles, Coins & Powerups
class Obstacle {
    constructor() {
        this.x = canvas.width + 50;
        this.type = Math.random() < 0.5 ? 'ground' : (Math.random() < 0.8 ? 'flying' : 'moving');
        
        if (this.type === 'ground') {
            this.width = 30 + Math.random() * 20;
            this.height = 35 + Math.random() * 15;
            this.y = groundY - this.height;
        } else if (this.type === 'flying') {
            this.width = 40;
            this.height = 25;
            this.y = groundY - 75; // Requires sliding or precise jump
        } else {
            this.width = 30;
            this.height = 30;
            this.y = groundY - 35;
            this.moveY = 1;
        }
    }

    update() {
        this.x -= gameSpeed;
        if (this.type === 'moving') {
            this.y += this.moveY;
            if (this.y < groundY - 70 || this.y > groundY - 30) this.moveY *= -1;
        }
    }

    draw() {
        ctx.fillStyle = this.type === 'ground' ? '#ef4444' : (this.type === 'flying' ? '#f97316' : '#a855f7');
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Hazard Markings
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x + 4, this.y + 4, 6, 6);
    }
}

class Coin {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 10;
        this.collected = false;
    }

    update() {
        this.x -= gameSpeed;
    }

    draw() {
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

class Powerup {
    constructor() {
        this.x = canvas.width + 50;
        this.y = groundY - 80;
        this.type = Math.random() < 0.5 ? 'shield' : 'speed';
        this.size = 22;
        this.collected = false;
    }

    update() {
        this.x -= gameSpeed;
    }

    draw() {
        ctx.fillStyle = this.type === 'shield' ? '#38bdf8' : '#eab308';
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.fillStyle = '#fff';
        ctx.font = '10px sans-serif';
        ctx.fillText(this.type === 'shield' ? 'S' : 'B', this.x + 7, this.y + 15);
    }
}

// Particle System
function createParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            size: Math.random() * 4 + 2,
            color: color,
            alpha: 1
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;
        if (p.alpha <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.restore();
    });
}

// Parallax Background & Day/Night Renderer
function drawBackground() {
    timeOfDay += 0.0005;
    let cycle = (Math.sin(timeOfDay) + 1) / 2; // Normalize 0 to 1

    // Sky Gradient Transition
    let skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    if (cycle > 0.5) {
        // Day
        skyGradient.addColorStop(0, '#38bdf8');
        skyGradient.addColorStop(1, '#bae6fd');
    } else {
        // Night
        skyGradient.addColorStop(0, '#0f172a');
        skyGradient.addColorStop(1, '#1e1b4b');
    }
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Parallax Layer: Distant Mountains
    ctx.fillStyle = cycle > 0.5 ? '#94a3b8' : '#334155';
    let mountainOffset = (frameCount * 0.5) % 400;
    for (let i = -1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 400 - mountainOffset, groundY);
        ctx.lineTo(i * 400 + 200 - mountainOffset, groundY - 120);
        ctx.lineTo(i * 400 + 400 - mountainOffset, groundY);
        ctx.fill();
    }

    // Ground Layer
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
    ctx.fillStyle = '#22c55e'; // Green top border
    ctx.fillRect(0, groundY, canvas.width, 6);
}

// Spawning Logic
function handleSpawning() {
    if (frameCount % 110 === 0) {
        obstacles.push(new Obstacle());
    }

    if (frameCount % 160 === 0) {
        let coinY = groundY - (Math.random() * 80 + 30);
        for (let i = 0; i < 3; i++) {
            coins.push(new Coin(canvas.width + (i * 25), coinY));
        }
    }

    if (frameCount % 450 === 0) {
        powerups.push(new Powerup());
    }
}

// Collision Detection (AABB)
function checkCollisions() {
    // Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        if (
            player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y
        ) {
            if (player.shieldActive) {
                player.shieldActive = false;
                soundManager.playCollision();
                createParticles(obs.x, obs.y, '#38bdf8', 12);
                obstacles.splice(i, 1);
            } else {
                triggerGameOver();
            }
        }
    }

    // Coins
    for (let i = coins.length - 1; i >= 0; i--) {
        let c = coins[i];
        let distX = (player.x + player.width / 2) - c.x;
        let distY = (player.y + player.height / 2) - c.y;
        let dist = Math.sqrt(distX * distX + distY * distY);

        if (dist < player.width / 2 + c.radius) {
            score += 10;
            soundManager.playCoin();
            createParticles(c.x, c.y, '#eab308', 6);
            coins.splice(i, 1);
        }
    }

    // Power-ups
    for (let i = powerups.length - 1; i >= 0; i--) {
        let p = powerups[i];
        if (
            player.x < p.x + p.size &&
            player.x + player.width > p.x &&
            player.y < p.y + p.size &&
            player.y + player.height > p.y
        ) {
            soundManager.playPowerup();
            if (p.type === 'shield') {
                player.shieldActive = true;
                player.shieldTimer = 300; // ~5 seconds
            } else if (p.type === 'speed') {
                player.speedBoostActive = true;
                player.speedBoostTimer = 240;
                gameSpeed = baseSpeed + 4;
            }
            createParticles(p.x, p.y, '#ffffff', 10);
            powerups.splice(i, 1);
        }
    }
}

// Game Flow Handlers
function startGame() {
    soundManager.init();
    gameState = STATE_PLAYING;
    distance = 0;
    score = 0;
    baseSpeed = 5;
    gameSpeed = baseSpeed;
    frameCount = 0;
    
    obstacles = [];
    coins = [];
    powerups = [];
    particles = [];
    
    player.reset();

    startScreen.classList.add('hidden');
    pauseScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    hud.classList.remove('hidden');

    highVal.innerText = highScore;
}

function togglePause() {
    if (gameState === STATE_PLAYING) {
        gameState = STATE_PAUSED;
        pauseScreen.classList.remove('hidden');
    } else if (gameState === STATE_PAUSED) {
        gameState = STATE_PLAYING;
        pauseScreen.classList.add('hidden');
    }
}

function triggerGameOver() {
    soundManager.playCollision();
    gameState = STATE_GAMEOVER;

    if (score > highScore) {
        highScore = score;
        localStorage.setItem('cyber_runner_highscore', highScore);
    }

    document.getElementById('finalDist').innerText = Math.floor(distance);
    document.getElementById('finalScore').innerText = score;
    document.getElementById('finalHighScore').innerText = highScore;

    hud.classList.add('hidden');
    gameOverScreen.classList.remove('hidden');
}

// Main Game Loop
function update() {
    if (gameState !== STATE_PLAYING) return;

    frameCount++;
    distance += gameSpeed * 0.05;
    score += 0.1;

    // Difficulty scaling
    if (frameCount % 500 === 0) {
        baseSpeed += 0.4;
        if (!player.speedBoostActive) gameSpeed = baseSpeed;
    }

    player.update();
    handleSpawning();

    // Update Obstacles & Collectibles
    obstacles.forEach((obs, index) => {
        obs.update();
        if (obs.x + obs.width < 0) obstacles.splice(index, 1);
    });

    coins.forEach((c, index) => {
        c.update();
        if (c.x < 0) coins.splice(index, 1);
    });

    powerups.forEach((p, index) => {
        p.update();
        if (p.x < 0) powerups.splice(index, 1);
    });

    updateParticles();
    checkCollisions();

    // Update HUD Text
    distVal.innerText = Math.floor(distance);
    scoreVal.innerText = Math.floor(score);

    if (player.shieldActive || player.speedBoostActive) {
        activePowerup.classList.remove('hidden');
        activePowerup.innerText = player.shieldActive ? "SHIELD" : "SPEED BOOST";
    } else {
        activePowerup.classList.add('hidden');
    }
}

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();

    // Draw entities
    obstacles.forEach(obs => obs.draw());
    coins.forEach(c => c.draw());
    powerups.forEach(p => p.draw());
    particles.forEach(p => p.draw());
    player.draw();
}

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// Input Controllers
window.addEventListener('keydown', (e) => {
    if (gameState !== STATE_PLAYING) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        player.jump();
    } else if (e.code === 'ArrowDown') {
        player.slide();
    }
});

// Mobile Controls
document.getElementById('mobileJumpBtn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === STATE_PLAYING) player.jump();
});

document.getElementById('mobileSlideBtn').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (gameState === STATE_PLAYING) player.slide();
});

// Touch Gestures on Canvas
let touchStartY = 0;
canvas.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
});

canvas.addEventListener('touchend', (e) => {
    let touchEndY = e.changedTouches[0].clientY;
    let diffY = touchEndY - touchStartY;

    if (gameState === STATE_PLAYING) {
        if (diffY < -30) {
            player.jump(); // Swipe Up
        } else if (diffY > 30) {
            player.slide(); // Swipe Down
        } else {
            player.jump(); // Tap
        }
    }
});

// Start Game Engine Loop
requestAnimationFrame(gameLoop);
