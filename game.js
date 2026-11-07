// 라윤 퀘스트 (Rayoon Quest) - Chapter 1: 마법의 숲
// 2인 협동 미션 플랫폼 게임 로직

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 게임 상태
const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;
const GRAVITY = 0.55;

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
    this.playTone(200, 'square', 0.2, 400);
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
  // 아빠 키 (WASD)
  KeyA: false, KeyD: false, KeyW: false,
  // 라윤 키 (방향키)
  ArrowLeft: false, ArrowRight: false, ArrowUp: false,
  // 모바일 통합 가상키
  TouchLeft: false, TouchRight: false, TouchJump: false
};

let mobileControlTarget = 'rayoon'; // 'dad' | 'rayoon'

// 이벤트 리스너 등록
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

// 모바일 터치 이벤트 바인딩
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

// 캐릭터 전환 버튼
document.getElementById('btn-char-switch').addEventListener('click', () => {
  mobileControlTarget = (mobileControlTarget === 'dad') ? 'rayoon' : 'dad';
  updateUI();
});

document.getElementById('btn-restart').addEventListener('click', () => resetGame());
document.getElementById('btn-next').addEventListener('click', () => resetGame());

// 플랫폼 맵 데이터
const platforms = [
  // 시작 왼쪽 언덕
  { x: 0, y: 440, w: 260, h: 100, color: '#3d7e35' },
  // 협곡 사이 이동식 도개교 다리 (스위치 누르면 내려옴)
  { x: 260, y: 440, w: 220, h: 24, color: '#8B5A2B', isBridge: true, currentAngle: 0.8, targetAngle: 0.8 },
  // 중앙 섬
  { x: 480, y: 440, w: 180, h: 100, color: '#3d7e35' },
  // 오른쪽 오두막 골인지점 언덕
  { x: 740, y: 400, w: 220, h: 140, color: '#3d7e35' },

  // 공중 부유 발판들 (라윤이 점프용)
  { x: 180, y: 320, w: 110, h: 22, color: '#4a9942' },
  { x: 360, y: 240, w: 110, h: 22, color: '#4a9942' },
  { x: 530, y: 290, w: 120, h: 22, color: '#4a9942' },
  { x: 670, y: 200, w: 100, h: 22, color: '#4a9942' },
  { x: 790, y: 260, w: 110, h: 22, color: '#4a9942' }
];

// 발판 스위치 (왼쪽 언덕 위)
const switchPlate = {
  x: 170, y: 432, w: 60, h: 10,
  isPressed: false,
  color: '#00d2ff'
};

// 황금별 5개
let stars = [
  { x: 235, y: 275, collected: false, floatY: 0 },
  { x: 415, y: 195, collected: false, floatY: 0 },
  { x: 590, y: 245, collected: false, floatY: 0 },
  { x: 720, y: 155, collected: false, floatY: 0 },
  { x: 845, y: 215, collected: false, floatY: 0 }
];

// 골 오두막 문
const goalDoor = {
  x: 850, y: 310, w: 60, h: 90,
  isOpen: false
};

// 캐릭터 객체
class Character {
  constructor(name, x, y, w, h, color, isDad = false) {
    this.name = name;
    this.startX = x;
    this.startY = y;
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.color = color;
    this.vx = 0;
    this.vy = 0;
    this.isGrounded = false;
    this.jumpCount = 0;
    this.maxJumps = isDad ? 1 : 2; // 라윤이는 2단점프 가능!
    this.jumpStrength = isDad ? -10.5 : -11.5;
    this.speed = isDad ? 3.6 : 4.4;
    this.isDad = isDad;
    this.facing = 1; // 1: 우측, -1: 좌측
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
    // 수평 이동
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

    // 점프 처리
    if (inputJump && !this.jumpHandled) {
      if (this.jumpCount < this.maxJumps) {
        this.vy = this.jumpStrength;
        this.jumpCount++;
        this.isGrounded = false;
        if (this.jumpCount === 1) sound.jump();
        else sound.doubleJump();
        addSparkles(this.x + this.w / 2, this.y + this.h, '#fff', 6);
      }
      this.jumpHandled = true;
    }
    if (!inputJump) {
      this.jumpHandled = false;
    }

    // 중력 적용
    this.vy += GRAVITY;
    this.x += this.vx;
    this.y += this.vy;

    // 플랫폼 충돌 판정
    this.isGrounded = false;
    for (let p of platforms) {
      // 다리가 올려져 있는 경우 충돌 스킵
      if (p.isBridge && p.currentAngle > 0.1) {
        continue;
      }

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

    // 맵 경계 제한 (낙하 방지 바닥)
    if (this.x < 0) this.x = 0;
    if (this.x + this.w > GAME_WIDTH) this.x = GAME_WIDTH - this.w;
    if (this.y > GAME_HEIGHT) {
      // 바닥으로 떨어지면 리스폰
      this.reset();
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    if (this.facing === -1) ctx.scale(-1, 1);

    if (this.isDad) {
      // [아빠 캐릭터 그리기]
      // 몸통 (파란 후드티)
      ctx.fillStyle = '#2980b9';
      ctx.beginPath();
      ctx.roundRect(-16, -10, 32, 28, 6);
      ctx.fill();

      // 바지 (베이지/갈색)
      ctx.fillStyle = '#7f5a3c';
      ctx.fillRect(-14, 18, 12, 10);
      ctx.fillRect(2, 18, 12, 10);

      // 머리 & 얼굴
      ctx.fillStyle = '#f5d3b3';
      ctx.beginPath();
      ctx.arc(0, -18, 13, 0, Math.PI * 2);
      ctx.fill();

      // 짧은 머리카락
      ctx.fillStyle = '#3e2723';
      ctx.beginPath();
      ctx.arc(0, -22, 13, Math.PI, 0, true);
      ctx.fill();

      // 눈
      ctx.fillStyle = '#222';
      ctx.fillRect(4, -20, 3, 4);

      // 다정한 미소
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(4, -15, 4, 0, Math.PI);
      ctx.stroke();

    } else {
      // [라윤이 캐릭터 그리기]
      // 몸통 (분홍 후드티/원피스)
      ctx.fillStyle = '#e84393';
      ctx.beginPath();
      ctx.roundRect(-12, -8, 24, 22, 6);
      ctx.fill();

      // 치마 & 신발
      ctx.fillStyle = '#fd79a8';
      ctx.fillRect(-12, 12, 24, 6);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-10, 18, 8, 4);
      ctx.fillRect(2, 18, 8, 4);

      // 머리 & 얼굴
      ctx.fillStyle = '#f5d3b3';
      ctx.beginPath();
      ctx.arc(0, -15, 11, 0, Math.PI * 2);
      ctx.fill();

      // 양갈래 머리 (시그니처 트윈테일)
      ctx.fillStyle = '#2d3436';
      ctx.beginPath();
      ctx.arc(0, -19, 11, Math.PI, 0, true);
      ctx.fill();
      // 왼쪽/오른쪽 묶음
      ctx.beginPath();
      ctx.arc(-11, -17, 6, 0, Math.PI * 2);
      ctx.arc(11, -17, 6, 0, Math.PI * 2);
      ctx.fill();
      // 머리 리본
      ctx.fillStyle = '#ff7675';
      ctx.fillRect(-12, -21, 4, 4);
      ctx.fillRect(8, -21, 4, 4);

      // 눈 (초롱초롱)
      ctx.fillStyle = '#222';
      ctx.fillRect(3, -17, 3, 3);

      // 밝은 미소
      ctx.strokeStyle = '#d63031';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(3, -13, 3, 0, Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  }
}

const dad = new Character('아빠', 50, 380, 32, 56, '#2980b9', true);
const rayoon = new Character('라윤', 100, 380, 26, 44, '#e84393', false);

// 게임 리셋
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

  // 모바일 UI 라벨 갱신
  const label = document.getElementById('current-control-label');
  if (label) {
    label.textContent = mobileControlTarget === 'dad' ? '현재 조작: 👨 아빠' : '현재 조작: 👧 라윤';
  }

  // 프로필 활성 탭 표시
  document.getElementById('dad-ui').classList.toggle('active', mobileControlTarget === 'dad');
  document.getElementById('rayoon-ui').classList.toggle('active', mobileControlTarget === 'rayoon');
}

// 메인 게임 루프
let tick = 0;
function gameLoop() {
  tick++;
  ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // 1. 배경 그리기 (동화 숲 풍경)
  drawBackground();

  // 2. 발판 스위치 체크 및 다리 각도 조정
  // 아빠가 스위치 위에 섰는지 체크
  const isDadOnSwitch = (
    dad.x + dad.w > switchPlate.x &&
    dad.x < switchPlate.x + switchPlate.w &&
    Math.abs(dad.y + dad.h - switchPlate.y) < 10
  );

  if (isDadOnSwitch !== switchPlate.isPressed) {
    switchPlate.isPressed = isDadOnSwitch;
    if (switchPlate.isPressed) {
      sound.switch();
      addSparkles(switchPlate.x + switchPlate.w / 2, switchPlate.y, '#00d2ff', 16);
    }
  }

  // 다리 움직임 (아빠가 누르면 서서히 내려오고, 내려서면 서서히 올라감)
  const bridge = platforms.find(p => p.isBridge);
  bridge.targetAngle = switchPlate.isPressed ? 0 : 0.8;
  bridge.currentAngle += (bridge.targetAngle - bridge.currentAngle) * 0.1;

  // 3. 입력 상태 분배
  const dadLeft = keys.KeyA || (mobileControlTarget === 'dad' && keys.TouchLeft);
  const dadRight = keys.KeyD || (mobileControlTarget === 'dad' && keys.TouchRight);
  const dadJump = keys.KeyW || (mobileControlTarget === 'dad' && keys.TouchJump);

  const rayoonLeft = keys.ArrowLeft || (mobileControlTarget === 'rayoon' && keys.TouchLeft);
  const rayoonRight = keys.ArrowRight || (mobileControlTarget === 'rayoon' && keys.TouchRight);
  const rayoonJump = keys.ArrowUp || (mobileControlTarget === 'rayoon' && keys.TouchJump);

  // 4. 캐릭터 업데이트
  dad.update(dadLeft, dadRight, dadJump);
  rayoon.update(rayoonLeft, rayoonRight, rayoonJump);

  // 5. 별 수집 판정
  stars.forEach((s) => {
    if (!s.collected) {
      // 라윤 또는 아빠와의 충돌 (라윤이가 먹을 확률이 높음)
      const distRayoon = Math.hypot((rayoon.x + rayoon.w / 2) - s.x, (rayoon.y + rayoon.h / 2) - s.y);
      const distDad = Math.hypot((dad.x + dad.w / 2) - s.x, (dad.y + dad.h / 2) - s.y);

      if (distRayoon < 30 || distDad < 35) {
        s.collected = true;
        sound.star();
        addSparkles(s.x, s.y, '#ffd700', 20);
        updateUI();
      }
    }
  });

  // 6. 골인 및 클리어 판정
  const allStarsCollected = stars.every(s => s.collected);
  if (allStarsCollected && !isCleared) {
    const isDadAtGoal = (dad.x + dad.w > goalDoor.x && dad.x < goalDoor.x + goalDoor.w);
    const isRayoonAtGoal = (rayoon.x + rayoon.w > goalDoor.x && rayoon.x < goalDoor.x + goalDoor.w);

    if (isDadAtGoal && isRayoonAtGoal) {
      isCleared = true;
      sound.clear();
      addSparkles(goalDoor.x + goalDoor.w / 2, goalDoor.y + goalDoor.h / 2, '#2ecc71', 40);
      document.getElementById('overlay').classList.remove('hidden');
    }
  }

  // 7. 오브젝트 그리기
  drawPlatforms();
  drawSwitch();
  drawBridge(bridge);
  drawGoal();
  drawStars();

  // 8. 캐릭터 그리기
  dad.draw();
  rayoon.draw();

  // 9. 파티클 업데이트 & 그리기
  drawParticles();

  requestAnimationFrame(gameLoop);
}

// 배경 렌더링
function drawBackground() {
  // 푸른 하늘 & 석양 그라디언트
  const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
  skyGrad.addColorStop(0, '#74b9ff');
  skyGrad.addColorStop(0.6, '#a8e6cf');
  skyGrad.addColorStop(1, '#dcedc1');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

  // 먼 산과 나무 실루엣
  ctx.fillStyle = 'rgba(116, 185, 255, 0.4)';
  ctx.beginPath();
  ctx.moveTo(0, 380);
  ctx.bezierCurveTo(200, 280, 400, 360, 600, 300);
  ctx.bezierCurveTo(750, 260, 850, 340, 960, 310);
  ctx.lineTo(960, GAME_HEIGHT);
  ctx.lineTo(0, GAME_HEIGHT);
  ctx.fill();

  // 계곡 시냇물 흐름
  ctx.fillStyle = '#0984e3';
  ctx.fillRect(250, 480, 240, 60);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(260 + (tick % 60), 500, 60, 4);
}

// 플랫폼 그리기
function drawPlatforms() {
  for (let p of platforms) {
    if (p.isBridge) continue; // 다리는 별도 함수에서 각도 적용해 그림

    ctx.save();
    // 흙 베이스
    ctx.fillStyle = '#5d4037';
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, p.h, 8);
    ctx.fill();

    // 잔디 윗면
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.roundRect(p.x, p.y, p.w, 14, [8, 8, 2, 2]);
    ctx.fill();

    // 귀여운 작은 꽃 장식
    ctx.fillStyle = '#ff7675';
    ctx.beginPath();
    ctx.arc(p.x + 20, p.y - 2, 3, 0, Math.PI * 2);
    ctx.arc(p.x + p.w - 20, p.y - 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

// 발판 스위치 그리기
function drawSwitch() {
  ctx.save();
  // 스위치 받침대
  ctx.fillStyle = '#7f8c8d';
  ctx.fillRect(switchPlate.x - 4, switchPlate.y + 4, switchPlate.w + 8, 8);

  // 스위치 본체
  const pressedOffset = switchPlate.isPressed ? 6 : 0;
  ctx.fillStyle = switchPlate.isPressed ? '#00d2ff' : '#0984e3';
  ctx.shadowColor = switchPlate.isPressed ? '#00d2ff' : 'transparent';
  ctx.shadowBlur = switchPlate.isPressed ? 15 : 0;

  ctx.beginPath();
  ctx.roundRect(switchPlate.x, switchPlate.y + pressedOffset, switchPlate.w, switchPlate.h - pressedOffset, 4);
  ctx.fill();

  // 발판 표식 안내 아이콘
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('아빠 발판 🐾', switchPlate.x + switchPlate.w / 2, switchPlate.y - 8);

  ctx.restore();
}

// 도개교 다리 그리기
function drawBridge(b) {
  ctx.save();
  // 다리 피벗 축 (260, 440)
  ctx.translate(b.x, b.y + 10);
  ctx.rotate(-b.currentAngle); // 각도 회전

  // 나무 발판 다리
  ctx.fillStyle = '#8B5A2B';
  ctx.fillRect(0, -10, b.w, 18);

  // 쇠사슬 체인 디테일
  ctx.strokeStyle = '#bdc3c7';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, -10, b.w, 18);

  ctx.restore();
}

// 골 오두막 문
function drawGoal() {
  ctx.save();
  // 문 틀
  ctx.fillStyle = '#4e342e';
  ctx.beginPath();
  ctx.roundRect(goalDoor.x, goalDoor.y, goalDoor.w, goalDoor.h, [20, 20, 0, 0]);
  ctx.fill();

  // 문짝
  if (goalDoor.isOpen) {
    // 문이 열리고 황금빛 포탈
    const grad = ctx.createLinearGradient(goalDoor.x, goalDoor.y, goalDoor.x, goalDoor.y + goalDoor.h);
    grad.addColorStop(0, '#f1c40f');
    grad.addColorStop(1, '#e67e22');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#f1c40f';
    ctx.shadowBlur = 20;
    ctx.fillRect(goalDoor.x + 6, goalDoor.y + 6, goalDoor.w - 12, goalDoor.h - 6);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GOAL! ✨', goalDoor.x + goalDoor.w / 2, goalDoor.y - 10);
  } else {
    // 닫힌 문
    ctx.fillStyle = '#6d4c41';
    ctx.fillRect(goalDoor.x + 6, goalDoor.y + 6, goalDoor.w - 12, goalDoor.h - 6);

    // 열쇠 구멍
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(goalDoor.x + goalDoor.w / 2, goalDoor.y + goalDoor.h / 2, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#aaa';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔒 잠김', goalDoor.x + goalDoor.w / 2, goalDoor.y - 10);
  }

  ctx.restore();
}

// 황금별 그리기
function drawStars() {
  stars.forEach((s, idx) => {
    if (s.collected) return;

    ctx.save();
    // 둥둥 떠 있는 부유 애니메이션
    const bob = Math.sin((tick + idx * 25) * 0.08) * 5;
    const y = s.y + bob;

    ctx.translate(s.x, y);
    ctx.fillStyle = '#ffd700';
    ctx.shadowColor = '#fffa65';
    ctx.shadowBlur = 12;

    // 5각 별 그리기
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * 14, -Math.sin((18 + i * 72) * Math.PI / 180) * 14);
      ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * 6, -Math.sin((54 + i * 72) * Math.PI / 180) * 6);
    }
    ctx.closePath();
    ctx.fill();

    // 깜찍한 눈
    ctx.fillStyle = '#333';
    ctx.fillRect(-3, -2, 2, 3);
    ctx.fillRect(2, -2, 2, 3);

    ctx.restore();
  });
}

// 파티클 렌더링
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

// 게임 시작
updateUI();
requestAnimationFrame(gameLoop);
