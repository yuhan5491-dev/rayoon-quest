// 라윤 퀘스트 (Rayoon Quest) - Chapter 1: 마법의 숲
// 2인 협동 미션 플랫폼 게임 로직 (고화질 그래픽 에셋 탑재 버전)

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const GRAVITY = 0.55;

// 그래픽 이미지 에셋 로딩
const bgImg = new Image();
bgImg.src = 'assets/bg.png';

const dadImg = new Image();
dadImg.src = 'assets/dad.png';

const rayoonImg = new Image();
rayoonImg.src = 'assets/rayoon.png';

const starImg = new Image();
starImg.src = 'assets/star.png';

// 사운드 시스템 (Web Audio API)
class SoundSystem {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
  }
  playTone(freq, type, duration, endFreq = null) {
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (endFreq) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);
      }
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch(e) {}
  }
  jump() {
    this.init();
    this.playTone(280, 'sine', 0.15, 520);
  }
  doubleJump() {
    this.init();
    this.playTone(450, 'sine', 0.18, 750);
  }
  switch() {
    this.init();
    this.playTone(220, 'square', 0.2, 440);
  }
  star() {
    this.init();
    this.playTone(587, 'triangle', 0.1, 880);
    setTimeout(() => this.playTone(880, 'triangle', 0.2, 1174), 80);
  }
  clear() {
    this.init();
    const notes = [523, 659, 783, 1046];
    notes.forEach((n, i) => {
      setTimeout(() => this.playTone(n, 'triangle', 0.35), i * 140);
    });
  }
}
const sound = new SoundSystem();

// 파티클 시스템
const particles = [];
function addSparkles(x, y, color = '#ffd700', count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 4 + 1;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 4 + 2,
      color,
      alpha: 1,
      life: 30 + Math.random() * 20
    });
  }
}

// 키 입력 상태
const keys = {
  KeyA: false, KeyD: false, KeyW: false,
  ArrowLeft: false, ArrowRight: false, ArrowUp: false,
  TouchLeft: false, TouchRight: false, TouchJump: false
};

let mobileControlTarget = 'rayoon'; // 'dad' | 'rayoon'

window.addEventListener('keydown', (e) => {
  sound.init();
  if (keys.hasOwnProperty(e.code)) {
    keys[e.code] = true;
    if (['ArrowUp', 'ArrowLeft', 'ArrowRight', 'KeyW'].includes(e.code)) e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  if (keys.hasOwnProperty(e.code)) {
    keys[e.code] = false;
  }
});

function bindTouchBtn(btnId, keyName) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  const start = (e) => { e.preventDefault(); sound.init(); keys[keyName] = true; };
  const end = (e) => { e.preventDefault(); keys[keyName] = false; };
  btn.addEventListener('touchstart', start, { passive: false });
  btn.addEventListener('touchend', end, { passive: false });
  btn.addEventListener('mousedown', start);
  btn.addEventListener('mouseup', end);
  btn.addEventListener('mouseleave', end);
}

bindTouchBtn('btn-left', 'TouchLeft');
bindTouchBtn('btn-right', 'TouchRight');
bindTouchBtn('btn-jump', 'TouchJump');

document.getElementById('btn-char-switch').addEventListener('click', () => {
  mobileControlTarget = (mobileControlTarget === 'dad') ? 'rayoon' : 'dad';
  updateUI();
});

document.getElementById('btn-restart').addEventListener('click', () => resetGame());
document.getElementById('btn-next').addEventListener('click', () => resetGame());

// 플랫폼 맵 데이터
const platforms = [
  // 시작 왼쪽 언덕
  { x: 0, y: 440, w: 260, h: 100, color: '#4caf50' },
  // 협곡 사이 도개교 다리
  { x: 260, y: 440, w: 220, h: 22, color: '#8d6e63', isBridge: true, currentAngle: 0.8, targetAngle: 0.8 },
  // 중앙 섬
  { x: 480, y: 440, w: 180, h: 100, color: '#4caf50' },
  // 오른쪽 오두막 골인지점 언덕
  { x: 740, y: 400, w: 220, h: 140, color: '#4caf50' },

  // 공중 부유 발판들
  { x: 180, y: 320, w: 110, h: 24, color: '#66bb6a' },
  { x: 360, y: 240, w: 110, h: 24, color: '#66bb6a' },
  { x: 530, y: 290, w: 120, h: 24, color: '#66bb6a' },
  { x: 670, y: 200, w: 100, h: 24, color: '#66bb6a' },
  { x: 790, y: 260, w: 110, h: 24, color: '#66bb6a' }
];

// 발판 스위치
const switchPlate = {
  x: 170, y: 430, w: 64, h: 12,
  isPressed: false,
  color: '#00d2ff'
};

// 황금별 5개
let stars = [
  { x: 235, y: 275, collected: false },
  { x: 415, y: 195, collected: false },
  { x: 590, y: 245, collected: false },
  { x: 720, y: 155, collected: false },
  { x: 845, y: 215, collected: false }
];

// 골 오두막 문
const goalDoor = {
  x: 840, y: 300, w: 70, h: 100,
  isOpen: false
};

// 캐릭터 객체
class Character {
  constructor(name, x, y, w, h, isDad = false) {
    this.name = name;
    this.startX = x;
    this.startY = y;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.isGrounded = false;
    this.jumpCount = 0;
    this.maxJumps = isDad ? 1 : 2;
    this.jumpStrength = isDad ? -10.5 : -11.8;
    this.speed = isDad ? 3.6 : 4.4;
    this.isDad = isDad;
    this.facing = 1;
  }

  reset() {
    this.x = this.startX;
    this.y = this.startY;
    this.vx = 0;
    this.vy = 0;
    this.isGrounded = false;
    this.jumpCount = 0;
  }

  update(inputLeft, inputRight, inputJump) {
    if (inputLeft) {
      this.vx = -this.speed;
      this.facing = -1;
    } else if (inputRight) {
      this.vx = this.speed;
      this.facing = 1;
    } else {
      this.vx *= 0.75;
      if (Math.abs(this.vx) < 0.1) this.vx = 0;
    }

    if (inputJump && !this.jumpHandled) {
      if (this.jumpCount < this.maxJumps) {
        this.vy = this.jumpStrength;
        this.jumpCount++;
        this.isGrounded = false;
        if (this.jumpCount === 1) sound.jump();
        else sound.doubleJump();
        addSparkles(this.x + this.w / 2, this.y + this.h, '#fff', 8);
      }
      this.jumpHandled = true;
    }
    if (!inputJump) {
      this.jumpHandled = false;
    }

    this.vy += GRAVITY;
    this.x += this.vx;
    this.y += this.vy;

    this.isGrounded = false;
    for (let p of platforms) {
      if (p.isBridge && p.currentAngle > 0.1) continue;

      if (
        this.x + this.w > p.x &&
        this.x < p.x + p.w &&
        this.y + this.h >= p.y &&
        this.y + this.h <= p.y + p.h + 10 &&
        this.vy >= 0
      ) {
        this.y = p.y - this.h;
        this.vy = 0;
        this.isGrounded = true;
        this.jumpCount = 0;
      }
    }

    if (this.x < 0) this.x = 0;
    if (this.x + this.w > GAME_WIDTH) this.x = GAME_WIDTH - this.w;
    if (this.y > GAME_HEIGHT) this.reset();
  }

  draw() {
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    if (this.facing === -1) ctx.scale(-1, 1);

    // 달릴 때 통통 튀는 바운스 효과
    const walkBob = Math.abs(this.vx) > 0.5 && this.isGrounded ? Math.sin(tick * 0.3) * 2 : 0;

    if (this.isDad) {
      if (dadImg.complete && dadImg.naturalWidth > 0) {
        // 고화질 아빠 스프라이트
        const drawH = this.h * 1.35;
        const drawW = drawH * (dadImg.naturalWidth / dadImg.naturalHeight);
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.drawImage(dadImg, -drawW / 2, -this.h / 2 - (drawH - this.h) + walkBob, drawW, drawH);
      } else {
        // 폴백
        ctx.fillStyle = '#2980b9';
        ctx.fillRect(-16, -10, 32, 28);
      }
    } else {
      if (rayoonImg.complete && rayoonImg.naturalWidth > 0) {
        // 고화질 라윤이 스프라이트
        const drawH = this.h * 1.45;
        const drawW = drawH * (rayoonImg.naturalWidth / rayoonImg.naturalHeight);
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.drawImage(rayoonImg, -drawW / 2, -this.h / 2 - (drawH - this.h) + walkBob, drawW, drawH);
      } else {
        // 폴백
        ctx.fillStyle = '#e84393';
        ctx.fillRect(-12, -8, 24, 22);
      }
    }

    ctx.restore();
  }
}

const dad = new Character('아빠', 50, 370, 34, 60, true);
const rayoon = new Character('라윤', 110, 380, 30, 48, false);

let isCleared = false;
function resetGame() {
  dad.reset();
  rayoon.reset();
  stars.forEach(s => s.collected = false);
  isCleared = false;
  document.getElementById('overlay').classList.add('hidden');
  updateUI();
}

function updateUI() {
  const collectedCount = stars.filter(s => s.collected).length;
  const missionText = document.getElementById('mission-status');
  if (collectedCount < 5) {
    missionText.textContent = `미션: 황금별 5개를 모두 모으세요! (⭐ ${collectedCount}/5)`;
    goalDoor.isOpen = false;
  } else {
    missionText.textContent = `미션: 오두막 문으로 둘 다 골인하세요! 🚪✨`;
    goalDoor.isOpen = true;
  }

  const label = document.getElementById('current-control-label');
  if (label) {
    label.textContent = mobileControlTarget === 'dad' ? '현재 조작: 👨 아빠' : '현재 조작: 👧 라윤';
  }

  document.getElementById('dad-ui').classList.toggle('active', mobileControlTarget === 'dad');
  document.getElementById('rayoon-ui').classList.toggle('active', mobileControlTarget === 'rayoon');
}

let tick = 0;
function gameLoop() {
  tick++;
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // 1. 고화질 배경 그리기
  drawBackground();

  // 2. 발판 스위치 체크
  const isDadOnSwitch = (
    dad.x + dad.w > switchPlate.x &&
    dad.x < switchPlate.x + switchPlate.w &&
    Math.abs(dad.y + dad.h - switchPlate.y) < 12
  );

  if (isDadOnSwitch !== switchPlate.isPressed) {
    switchPlate.isPressed = isDadOnSwitch;
    if (switchPlate.isPressed) {
      sound.switch();
      addSparkles(switchPlate.x + switchPlate.w / 2, switchPlate.y, '#00d2ff', 20);
    }
  }

  // 도개교 다리 각도 보간
  const bridge = platforms.find(p => p.isBridge);
  bridge.targetAngle = switchPlate.isPressed ? 0 : 0.8;
  bridge.currentAngle += (bridge.targetAngle - bridge.currentAngle) * 0.1;

  // 3. 입력
  const dadLeft = keys.KeyA || (mobileControlTarget === 'dad' && keys.TouchLeft);
  const dadRight = keys.KeyD || (mobileControlTarget === 'dad' && keys.TouchRight);
  const dadJump = keys.KeyW || (mobileControlTarget === 'dad' && keys.TouchJump);

  const rayoonLeft = keys.ArrowLeft || (mobileControlTarget === 'rayoon' && keys.TouchLeft);
  const rayoonRight = keys.ArrowRight || (mobileControlTarget === 'rayoon' && keys.TouchRight);
  const rayoonJump = keys.ArrowUp || (mobileControlTarget === 'rayoon' && keys.TouchJump);

  // 4. 업데이트
  dad.update(dadLeft, dadRight, dadJump);
  rayoon.update(rayoonLeft, rayoonRight, rayoonJump);

  // 5. 별 수집
  stars.forEach((s) => {
    if (!s.collected) {
      const distRayoon = Math.hypot((rayoon.x + rayoon.w / 2) - s.x, (rayoon.y + rayoon.h / 2) - s.y);
      const distDad = Math.hypot((dad.x + dad.w / 2) - s.x, (dad.y + dad.h / 2) - s.y);

      if (distRayoon < 36 || distDad < 40) {
        s.collected = true;
        sound.star();
        addSparkles(s.x, s.y, '#ffd700', 25);
        updateUI();
      }
    }
  });

  // 6. 골인 체크
  const allStarsCollected = stars.every(s => s.collected);
  if (allStarsCollected && !isCleared) {
    const isDadAtGoal = (dad.x + dad.w > goalDoor.x && dad.x < goalDoor.x + goalDoor.w);
    const isRayoonAtGoal = (rayoon.x + rayoon.w > goalDoor.x && rayoon.x < goalDoor.x + goalDoor.w);

    if (isDadAtGoal && isRayoonAtGoal) {
      isCleared = true;
      sound.clear();
      addSparkles(goalDoor.x + goalDoor.w / 2, goalDoor.y + goalDoor.h / 2, '#2ecc71', 50);
      document.getElementById('overlay').classList.remove('hidden');
    }
  }

  // 7. 오브젝트 렌더링
  drawPlatforms();
  drawSwitch();
  drawBridge(bridge);
  drawGoal();
  drawStars();

  // 8. 캐릭터 렌더링
  dad.draw();
  rayoon.draw();

  // 9. 파티클
  drawParticles();

  requestAnimationFrame(gameLoop);
}

// 배경 렌더링
function drawBackground() {
  if (bgImg.complete && bgImg.naturalWidth > 0) {
    ctx.drawImage(bgImg, 0, 0, GAME_WIDTH, GAME_HEIGHT);
    // 살짝 어둡게 해서 게임 오브젝트가 돋보이도록 오버레이
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  } else {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    skyGrad.addColorStop(0, '#74b9ff');
    skyGrad.addColorStop(1, '#a8e6cf');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }
}

// 플랫폼 렌더링
function drawPlatforms() {
  for (let p of platforms) {
    if (p.isBridge) continue;

    ctx.save();
    // 섬 아래 흙/바위 그림자
    ctx.fillStyle = '#4e342e';
    ctx.beginPath();
    ctx.roundRect(p.x, p.y + 12, p.w, p.h - 12, [0, 0, 16, 16]);
    ctx.fill();

    // 흙 텍스처 디테일
    ctx.fillStyle = '#3e2723';
    ctx.fillRect(p.x + 8, p.y + 20, p.w - 16, 6);

    // 잔디 윗면 (화사한 연두/초록 그라디언트)
    const grassGrad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + 16);
    grassGrad.addColorStop(0, '#81c784');
    grassGrad.addColorStop(1, '#388e3c');
    ctx.fillStyle = grassGrad;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, 16, [10, 10, 4, 4]);
    ctx.fill();

    // 잔디 위 꽃 장식
    ctx.fillStyle = '#ff80ab';
    ctx.beginPath();
    ctx.arc(p.x + 18, p.y - 1, 3.5, 0, Math.PI * 2);
    ctx.arc(p.x + p.w - 18, p.y - 1, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// 발판 스위치 렌더링
function drawSwitch() {
  ctx.save();
  // 스위치 베이스
  ctx.fillStyle = '#37474f';
  ctx.beginPath();
  ctx.roundRect(switchPlate.x - 6, switchPlate.y + 4, switchPlate.w + 12, 10, 4);
  ctx.fill();

  const pressedOffset = switchPlate.isPressed ? 6 : 0;
  
  // 마법 룬 발판
  const switchGrad = ctx.createLinearGradient(switchPlate.x, switchPlate.y, switchPlate.x, switchPlate.y + 10);
  switchGrad.addColorStop(0, switchPlate.isPressed ? '#80d8ff' : '#0091ea');
  switchGrad.addColorStop(1, switchPlate.isPressed ? '#00b0ff' : '#01579b');
  ctx.fillStyle = switchGrad;
  ctx.shadowColor = switchPlate.isPressed ? '#00e5ff' : '#0091ea';
  ctx.shadowBlur = switchPlate.isPressed ? 20 : 6;

  ctx.beginPath();
  ctx.roundRect(switchPlate.x, switchPlate.y + pressedOffset, switchPlate.w, switchPlate.h - pressedOffset, 6);
  ctx.fill();

  // 상단 발판 라벨
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 4;
  ctx.fillText('🐾 아빠 발판', switchPlate.x + switchPlate.w / 2, switchPlate.y - 8);

  ctx.restore();
}

// 도개교 다리 렌더링
function drawBridge(b) {
  ctx.save();
  ctx.translate(b.x, b.y + 10);
  ctx.rotate(-b.currentAngle);

  // 나무 발판
  const woodGrad = ctx.createLinearGradient(0, -10, 0, 10);
  woodGrad.addColorStop(0, '#a1887f');
  woodGrad.addColorStop(1, '#5d4037');
  ctx.fillStyle = woodGrad;
  ctx.beginPath();
  ctx.roundRect(0, -10, b.w, 20, 4);
  ctx.fill();

  // 판자 디테일
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = 1.5;
  for (let x = 20; x < b.w; x += 25) {
    ctx.beginPath();
    ctx.moveTo(x, -10);
    ctx.lineTo(x, 10);
    ctx.stroke();
  }

  // 쇠사슬 체인
  ctx.strokeStyle = '#cfd8dc';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(2, -10, b.w - 4, 20);

  ctx.restore();
}

// 오두막 골 문 렌더링
function drawGoal() {
  ctx.save();
  // 문 틀
  ctx.fillStyle = '#3e2723';
  ctx.beginPath();
  ctx.roundRect(goalDoor.x, goalDoor.y, goalDoor.w, goalDoor.h, [24, 24, 0, 0]);
  ctx.fill();

  if (goalDoor.isOpen) {
    // 열린 황금빛 포탈
    const portalGrad = ctx.createLinearGradient(goalDoor.x, goalDoor.y, goalDoor.x, goalDoor.y + goalDoor.h);
    portalGrad.addColorStop(0, '#fff59d');
    portalGrad.addColorStop(0.5, '#ffd54f');
    portalGrad.addColorStop(1, '#ff8f00');
    ctx.fillStyle = portalGrad;
    ctx.shadowColor = '#ffd54f';
    ctx.shadowBlur = 25;
    ctx.fillRect(goalDoor.x + 6, goalDoor.y + 6, goalDoor.w - 12, goalDoor.h - 6);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText('✨ GOAL! ✨', goalDoor.x + goalDoor.w / 2, goalDoor.y - 10);
  } else {
    // 닫힌 나무 문
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(goalDoor.x + 6, goalDoor.y + 6, goalDoor.w - 12, goalDoor.h - 6);

    // 황금 자물쇠 구멍
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(goalDoor.x + goalDoor.w / 2, goalDoor.y + goalDoor.h / 2, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText('🔒 별 5개 필요', goalDoor.x + goalDoor.w / 2, goalDoor.y - 10);
  }

  ctx.restore();
}

// 황금별 렌더링
function drawStars() {
  stars.forEach((s, idx) => {
    if (s.collected) return;

    ctx.save();
    const bob = Math.sin((tick + idx * 25) * 0.08) * 6;
    const y = s.y + bob;

    ctx.translate(s.x, y);

    if (starImg.complete && starImg.naturalWidth > 0) {
      const starSize = 44;
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 15;
      ctx.drawImage(starImg, -starSize / 2, -starSize / 2, starSize, starSize);
    } else {
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  });
}

// 파티클
function drawParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.alpha -= 0.025;

    if (p.alpha <= 0) {
      particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

updateUI();
requestAnimationFrame(gameLoop);
