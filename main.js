// 重力反転テトリス・プロトタイプ実装
// 仕様のポイント:
// - gravityDir: +1 = 下方向, -1 = 上方向
// - 各ピースがロックされるたびに gravityDir を反転
// - 回転方向も gravityDir に同期して反転

const COLS = 10;
const ROWS = 30; // 以前の 1.5 倍の高さに拡張
const CELL_SIZE = 20;

// ゲーム速度（1マス落下にかかる秒数）
const NORMAL_DROP_INTERVAL = 0.7;
// ソフトドロップは以前より 1/2 の速度（= 少し遅め）に調整
const SOFT_DROP_INTERVAL = 0.1;

// ボード: board[y][x] = 0 or カラーインデックス
let board = createEmptyBoard();

// 重力方向 (+1 = 下, -1 = 上)
let gravityDir = 1;

// 現在のテトロミノ
let currentPiece = null;

// ドロップタイマー
let dropAccumulator = 0;
let dropInterval = NORMAL_DROP_INTERVAL;

// 入力状態
let keyLeft = false;
let keyRight = false;
let keyDown = false;

// 単発キー処理のためのフラグ
let rotateQueued = false;
let hardDropQueued = false;

let lastTime = 0;
let gameOver = false;
let score = 0;

// スポーン演出用（次元の壁から現れるアニメーション）
const SPAWN_TOTAL_DURATION = 0.25; // 出現〜余韻まで
let spawnAnim = {
  active: false,
  elapsed: 0,
};

// 描画関連
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");

// テトロミノ定義: 4x4 マトリクス * 回転 4 状態
// マトリクスは行単位で定義 (matrix[row][col])
// 参照: https://tetris.wiki/SRS より単純化したもの
const TETROMINOS = [
  {
    name: "I",
    color: "#00ffff",
    rotations: [
      [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 1, 0],
      ],
      [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
      ],
      [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
      ],
    ],
  },
  {
    name: "O",
    color: "#ffff00",
    rotations: [
      [
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      // O は全回転同一
      [
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 1, 1, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
    ],
  },
  {
    name: "T",
    color: "#aa00ff",
    rotations: [
      [
        [0, 1, 0, 0],
        [1, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 1, 0, 0],
        [0, 1, 1, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 0, 0],
        [1, 1, 1, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 1, 0, 0],
        [1, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
      ],
    ],
  },
  {
    name: "L",
    color: "#ff8800",
    rotations: [
      [
        [0, 0, 1, 0],
        [1, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 0, 0],
        [1, 1, 1, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [1, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
      ],
    ],
  },
  {
    name: "J",
    color: "#0000ff",
    rotations: [
      [
        [1, 0, 0, 0],
        [1, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 1, 1, 0],
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 0, 0],
        [1, 1, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 1, 0, 0],
        [0, 1, 0, 0],
        [1, 1, 0, 0],
        [0, 0, 0, 0],
      ],
    ],
  },
  {
    name: "S",
    color: "#00ff00",
    rotations: [
      [
        [0, 1, 1, 0],
        [1, 1, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 1, 0, 0],
        [0, 1, 1, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 0, 0],
        [0, 1, 1, 0],
        [1, 1, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [1, 0, 0, 0],
        [1, 1, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
      ],
    ],
  },
  {
    name: "Z",
    color: "#ff0000",
    rotations: [
      [
        [1, 1, 0, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 1, 0],
        [0, 1, 1, 0],
        [0, 1, 0, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 0, 0, 0],
        [1, 1, 0, 0],
        [0, 1, 1, 0],
        [0, 0, 0, 0],
      ],
      [
        [0, 1, 0, 0],
        [1, 1, 0, 0],
        [1, 0, 0, 0],
        [0, 0, 0, 0],
      ],
    ],
  },
];

// ピース生成
function spawnPiece() {
  const def = TETROMINOS[(Math.random() * TETROMINOS.length) | 0];
  const rotation = 0;
  // 盤面の縦軸・横軸の真ん中（完全な中心）付近に 4x4 のピースを配置する
  const centerX = Math.floor(COLS / 2) - 2;
  const centerY = Math.floor(ROWS / 2) - 2;
  const x = centerX;
  const y = centerY;

  const piece = {
    def,
    x,
    y,
    rotation,
  };

  if (!isValidPosition(piece, x, y, rotation)) {
    // スポーン不可 = ゲームオーバー
    gameOver = true;
    statusEl.textContent = "GAME OVER";
    return null;
  }

  // 砲口からブロックが「放出」されるアニメーションを開始（ロジックには影響しない）
  spawnAnim.active = true;
  spawnAnim.elapsed = 0;

  return piece;
}

function createEmptyBoard() {
  const b = [];
  for (let y = 0; y < ROWS; y++) {
    const row = new Array(COLS).fill(0);
    b.push(row);
  }
  return b;
}

// 衝突判定
function isValidPosition(piece, newX, newY, newRot) {
  const shape = piece.def.rotations[newRot];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (!shape[row][col]) continue;
      const x = newX + col;
      const y = newY + row;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) {
        return false;
      }
      if (board[y][x]) {
        return false;
      }
    }
  }
  return true;
}

// ピースをボードにロック
function lockPiece(piece) {
  const shape = piece.def.rotations[piece.rotation];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      if (!shape[row][col]) continue;
      const x = piece.x + col;
      const y = piece.y + row;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        board[y][x] = piece.def.color;
      }
    }
  }

  // ライン消去 & スコア計算
  const cleared = clearLinesWithCurrentGravity();
  if (cleared > 0) {
    // シンプルな「本来のテトリス」に近いラインスコア
    // 1列:100, 2列:300, 3列:500, 4列以上:800
    if (cleared === 1) score += 100;
    else if (cleared === 2) score += 300;
    else if (cleared === 3) score += 500;
    else score += 800;
  }

  // 重力反転
  gravityDir *= -1;

  // 次のピースをスポーン
  currentPiece = spawnPiece();
}

// ライン消去（盤面の縦中央で上下を分割し、それぞれ独立して詰める）
function clearLinesWithCurrentGravity() {
  const fullLines = [];
  for (let y = 0; y < ROWS; y++) {
    let full = true;
    for (let x = 0; x < COLS; x++) {
      if (!board[y][x]) {
        full = false;
        break;
      }
    }
    if (full) fullLines.push(y);
  }

  if (fullLines.length === 0) return 0;

  // 盤面の縦中央で上下を分割し、それぞれ独立して「自分側」に詰める。
  // これにより、下側のライン消去で上側の積み、上側のライン消去で下側の積みが
  // 影響を受けないようにする。

  const midRow = Math.floor(ROWS / 2);

  // 下側（midRow ～ ROWS-1）: 通常テトリスと同様に「下方向」へ詰める
  {
    const bottomLines = fullLines.filter((y) => y >= midRow);
    if (bottomLines.length > 0) {
      let writeRow = ROWS - 1;
      for (let y = ROWS - 1; y >= midRow; y--) {
        if (bottomLines.includes(y)) continue;
        if (writeRow !== y) {
          board[writeRow] = board[y];
        }
        writeRow--;
      }
      // 中央境界までを空行で埋める（上側には影響を与えない）
      for (let y = writeRow; y >= midRow; y--) {
        board[y] = new Array(COLS).fill(0);
      }
    }
  }

  // 上側（0 ～ midRow-1）: 反転テトリスとして「上方向」へ詰める
  {
    const topLines = fullLines.filter((y) => y < midRow);
    if (topLines.length > 0) {
      let writeRow = 0;
      for (let y = 0; y < midRow; y++) {
        if (topLines.includes(y)) continue;
        if (writeRow !== y) {
          board[writeRow] = board[y];
        }
        writeRow++;
      }
      // 中央境界直前までを空行で埋める（下側には影響を与えない）
      for (let y = writeRow; y < midRow; y++) {
        board[y] = new Array(COLS).fill(0);
      }
    }
  }

  return fullLines.length;
}

// 回転（重力に応じて方向を変える）
function rotatePiece() {
  if (!currentPiece) return;
  const dir = gravityDir === 1 ? 1 : -1; // 下: 時計回り(+1), 上: 反時計回り(-1)
  const newRot =
    (currentPiece.rotation + dir + currentPiece.def.rotations.length) %
    currentPiece.def.rotations.length;
  if (isValidPosition(currentPiece, currentPiece.x, currentPiece.y, newRot)) {
    currentPiece.rotation = newRot;
  }
}

// 左右移動（画面基準）
function movePieceHor(dx) {
  if (!currentPiece) return;
  const newX = currentPiece.x + dx;
  if (isValidPosition(currentPiece, newX, currentPiece.y, currentPiece.rotation)) {
    currentPiece.x = newX;
  }
}

// 重力方向への 1 ステップ移動。移動できなければロック。
function stepGravity() {
  if (!currentPiece) return;
  const newY = currentPiece.y + gravityDir;
  if (isValidPosition(currentPiece, currentPiece.x, newY, currentPiece.rotation)) {
    currentPiece.y = newY;
  } else {
    // これ以上進めないのでロック
    lockPiece(currentPiece);
  }
}

// ハードドロップ
function hardDrop() {
  if (!currentPiece) return;
  while (true) {
    const newY = currentPiece.y + gravityDir;
    if (isValidPosition(currentPiece, currentPiece.x, newY, currentPiece.rotation)) {
      currentPiece.y = newY;
    } else {
      break;
    }
  }
  lockPiece(currentPiece);
}

// 描画
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 次のブロックが出現する領域を薄く発光させる
  drawSpawnHighlight();

  // ボード
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = board[y][x];
      if (cell) {
        drawCell(x, y, cell);
      } else {
        // グリッド線として薄い枠を描く（装飾というよりデバッグ用）
        ctx.strokeStyle = "#222";
        ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  // 現在のピース
  if (currentPiece) {
    const shape = currentPiece.def.rotations[currentPiece.rotation];
    const animActive = spawnAnim.active;
    let appearT = 0;
    let eased = 0;
    if (animActive) {
      // 0 → 1 に向かう時間割合
      appearT = Math.min(spawnAnim.elapsed / SPAWN_TOTAL_DURATION, 1);
      // 次元の壁からにじみ出てくるような、少しだけ伸びのあるイージング
      eased = 1 - (1 - appearT) * (1 - appearT);
    }

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        if (!shape[row][col]) continue;
        const x = currentPiece.x + col;
        const y = currentPiece.y + row;
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;

        if (!animActive) {
          // 通常描画
          drawCell(x, y, currentPiece.def.color);
        } else {
          // 盤面のそのマスの中心から「次元の壁を破って」現れる演出
          const cx = x * CELL_SIZE + CELL_SIZE / 2;
          const cy = y * CELL_SIZE + CELL_SIZE / 2;
          // 少しだけ大きくなってから収束するスケール
          const scale = 0.6 + 0.6 * eased; // 0.6 → 1.2 付近
          // 出現直後は強く光り、その後収束
          const alpha = 0.5 + 0.5 * eased;
          drawCellFromCenter(cx, cy, currentPiece.def.color, scale, alpha);
        }
      }
    }
  }

  // 重力方向の表示
  if (!gameOver) {
    const currentText = gravityDir === 1 ? "↓ (下)" : "↑ (上)";
    statusEl.textContent =
      "Gravity: " + currentText + "   Score: " + score;
  }
}

function drawCell(x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  ctx.strokeStyle = "#000";
  ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
}

// 中心座標とスケールからセルを描画（発射アニメーション用）
function drawCellFromCenter(cx, cy, color, scale = 1, alpha = 1) {
  const size = CELL_SIZE * scale;
  const x = cx - size / 2;
  const y = cy - size / 2;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "#000";
  ctx.strokeRect(x, y, size, size);
  ctx.restore();
}

// ブロックが出現する 4x4 領域を事前にハイライト表示
function drawSpawnHighlight() {
  // spawnPiece と同じロジックで中心 4x4 の左上を計算
  const centerX = Math.floor(COLS / 2) - 2;
  const centerY = Math.floor(ROWS / 2) - 2;

  ctx.save();
  ctx.globalAlpha = 0.15;
  ctx.fillStyle = "#ffffff";

  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const x = centerX + col;
      const y = centerY + row;
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
      ctx.fillRect(
        x * CELL_SIZE,
        y * CELL_SIZE,
        CELL_SIZE,
        CELL_SIZE
      );
    }
  }

  ctx.restore();
}

// 入力処理
document.addEventListener("keydown", (e) => {
  if (gameOver) return;

  if (e.code === "ArrowLeft") {
    keyLeft = true;
    movePieceHor(-1);
  } else if (e.code === "ArrowRight") {
    keyRight = true;
    movePieceHor(1);
  } else if (e.code === "ArrowDown") {
    if (gravityDir === 1) {
      // 下向き重力: ↓ でソフトドロップ
      keyDown = true;
    } else {
      // 上向き重力: ↓ で回転
      rotateQueued = true;
    }
  } else if (e.code === "ArrowUp") {
    if (gravityDir === 1) {
      // 下向き重力: ↑ で回転
      rotateQueued = true;
    } else {
      // 上向き重力: ↑ でソフトドロップ（上方向への加速）
      keyDown = true;
    }
  } else if (e.code === "Space") {
    hardDropQueued = true;
    e.preventDefault();
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft") {
    keyLeft = false;
  } else if (e.code === "ArrowRight") {
    keyRight = false;
  } else if (e.code === "ArrowDown" || e.code === "ArrowUp") {
    keyDown = false;
  }
});

// メインループ
function update(delta) {
  if (gameOver) {
    draw();
    return;
  }

  // 発射アニメーションの経過時間更新
  if (spawnAnim.active) {
    spawnAnim.elapsed += delta;
    if (spawnAnim.elapsed >= SPAWN_TOTAL_DURATION) {
      spawnAnim.active = false;
    }
  }

  // ドロップ速度切り替え
  dropInterval = keyDown ? SOFT_DROP_INTERVAL : NORMAL_DROP_INTERVAL;

  // 回転（単発）
  if (rotateQueued) {
    rotateQueued = false;
    rotatePiece();
  }

  // ハードドロップ（単発）
  if (hardDropQueued) {
    hardDropQueued = false;
    hardDrop();
  }

  // 経過時間に応じて重力方向へ 1 ステップ進める
  dropAccumulator += delta;
  while (dropAccumulator >= dropInterval) {
    dropAccumulator -= dropInterval;
    stepGravity();
  }

  draw();
}

function gameLoop(timestamp) {
  const t = timestamp / 1000;
  const delta = lastTime ? t - lastTime : 0;
  lastTime = t;

  update(delta);
  requestAnimationFrame(gameLoop);
}

// 初期化
function init() {
  canvas.width = COLS * CELL_SIZE;
  canvas.height = ROWS * CELL_SIZE;
  board = createEmptyBoard();
  gravityDir = 1;
  gameOver = false;
  dropAccumulator = 0;
  lastTime = 0;
  currentPiece = spawnPiece();
  requestAnimationFrame(gameLoop);
}

init();

