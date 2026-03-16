//  Frame Difference + Campo de Partículas Reactivo

let capture;
let frameBuffer = [];
let particles   = [];
let auraLayer;

let particleSlider, threshSlider;
let labelsCreados = false;

const BUFFER_SIZE = 8;
const SLOW_MAX  =   5000;
const MED_MAX   =  40000;
const FAST_MIN  = 200000;

let estadoActual        = "quieto";
let intensidadSuavizada = 0;
let t_noise  = 0;
let gridPrev = null;

const UMBRAL_BINARIO = 140;

// ─────────────────────────────────────────
function setup() {
  let cnv = createCanvas(640, 480);

  // centrar canvas en la ventana
  cnv.style("display", "block");
  cnv.style("position", "absolute");
  cnv.style("top", "50%");
  cnv.style("left", "50%");
  cnv.style("transform", "translate(-50%, -50%)");

  // fondo negro del body
  select("body").style("margin", "0");
  select("body").style("background", "#000");
  select("body").style("overflow", "hidden");

  colorMode(HSB, 360, 100, 100, 100);

  capture = createCapture(VIDEO);
  capture.size(640, 480);
  capture.hide();

  auraLayer = createGraphics(640, 480);
  auraLayer.colorMode(HSB, 360, 100, 100, 100);
  auraLayer.background(0, 0, 0);

  particleSlider = createSlider(400, 900, 650, 50);
  particleSlider.position(20, 500);
  particleSlider.style("width", "150px");

  threshSlider = createSlider(5, 60, 20, 1);
  threshSlider.position(220, 500);
  threshSlider.style("width", "150px");

  for (let i = 0; i < 650; i++) {
    particles.push(crearParticula(random(width), random(height)));
  }
}

// ─────────────────────────────────────────
function crearParticula(x, y) {
  let base = random(7, 14);
  return {
    x, y,
    vx: 0, vy: 0,
    hue: 0, sat: 0,
    bri: random(70, 95),
    sizeBase: base,
    sizeCurrent: base,
    noiseOff: random(100)
  };
}

// ─────────────────────────────────────────
function draw() {
  background(0, 0, 0);

  let THRESHOLD   = threshSlider.value();
  let targetCount = particleSlider.value();

  while (particles.length < targetCount) {
    particles.push(crearParticula(random(width), random(height)));
  }
  if (particles.length > targetCount) particles.length = targetCount;

  // ── buffer de frames ──────────────────
  capture.loadPixels();
  if (!capture.pixels || capture.pixels.length === 0) return;

  frameBuffer.push(new Uint8ClampedArray(capture.pixels));
  if (frameBuffer.length > BUFFER_SIZE) frameBuffer.shift();
  if (frameBuffer.length < 2) return;

  let oldFrame = frameBuffer[0];
  let newFrame = frameBuffer[frameBuffer.length - 1];

  // ── frame difference → grid ───────────
  let cellSize = 16;
  let cols = ceil(width  / cellSize);
  let rows = ceil(height / cellSize);

  let gridCurr = new Array(cols * rows).fill(null).map(() => ({
    mag: 0, count: 0, dirX: 0, dirY: 0
  }));

  let totalDiff = 0;
  let diffLeft  = 0, diffRight = 0;
  let diffUp    = 0, diffDown  = 0;
  let midX = width / 2, midY = height / 2;
  let margen = 8;

  for (let y = margen; y < height - margen; y += 4) {
    for (let x = margen; x < width - margen; x += 4) {
      let mx  = width - 1 - x;
      let idx = (y * width + mx) * 4;

      let mag = (
        abs(newFrame[idx]     - oldFrame[idx])     +
        abs(newFrame[idx + 1] - oldFrame[idx + 1]) +
        abs(newFrame[idx + 2] - oldFrame[idx + 2])
      ) / 3;

      if (mag > THRESHOLD) {
        totalDiff += mag;
        if (x < midX) diffLeft  += mag; else diffRight += mag;
        if (y < midY) diffUp    += mag; else diffDown  += mag;

        let col = floor(x / cellSize);
        let row = floor(y / cellSize);
        let ci  = row * cols + col;
        gridCurr[ci].mag   += mag;
        gridCurr[ci].count += 1;
      }
    }
  }

  for (let c of gridCurr) {
    if (c.count > 0) c.mag /= c.count;
  }

  // ── dirección local por celda ─────────
  if (gridPrev) {
    for (let row = 1; row < rows - 1; row++) {
      for (let col = 1; col < cols - 1; col++) {
        let ci = row * cols + col;

        let magL = gridCurr[row * cols + (col - 1)].mag;
        let magR = gridCurr[row * cols + (col + 1)].mag;
        let magU = gridCurr[(row - 1) * cols + col].mag;
        let magD = gridCurr[(row + 1) * cols + col].mag;

        let prevL = gridPrev[row * cols + (col - 1)].mag;
        let prevR = gridPrev[row * cols + (col + 1)].mag;
        let prevU = gridPrev[(row - 1) * cols + col].mag;
        let prevD = gridPrev[(row + 1) * cols + col].mag;

        let dx = (magR - magL) - (prevR - prevL);
        let dy = (magD - magU) - (prevD - prevU);
        let dm = sqrt(dx * dx + dy * dy);

        if (dm > 0.01) {
          gridCurr[ci].dirX = dx / dm;
          gridCurr[ci].dirY = dy / dm;
        } else {
          let gx = magR - magL;
          let gy = magD - magU;
          let gm = sqrt(gx * gx + gy * gy);
          gridCurr[ci].dirX = gm > 0.01 ? gx / gm : 0;
          gridCurr[ci].dirY = gm > 0.01 ? gy / gm : 0;
        }
      }
    }
  }

  gridPrev = gridCurr;

  let dirGX   = diffRight - diffLeft;
  let dirGY   = diffDown  - diffUp;
  let dirGMag = sqrt(dirGX * dirGX + dirGY * dirGY);
  if (dirGMag > 0) { dirGX /= dirGMag; dirGY /= dirGMag; }

  // ── suavizado de estado ───────────────
  intensidadSuavizada = lerp(intensidadSuavizada, totalDiff, 0.08);

  if      (intensidadSuavizada < SLOW_MAX) estadoActual = "quieto";
  else if (intensidadSuavizada < MED_MAX)  estadoActual = "lento";
  else if (intensidadSuavizada < FAST_MIN) estadoActual = "medio";
  else                                     estadoActual = "rapido";

  let t   = constrain(map(totalDiff, SLOW_MAX, FAST_MIN, 0, 1), 0, 1);
  let hue = lerp(220, 0, t);

  // ── aura layer ────────────────────────
  auraLayer.noStroke();
  auraLayer.fill(0, 0, 0, 25);
  auraLayer.rect(0, 0, width, height);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let ci    = row * cols + col;
      let celda = gridCurr[ci];

      if (celda.mag > THRESHOLD * 2) {
        let cx     = col * cellSize + cellSize / 2;
        let cy     = row * cellSize + cellSize / 2;
        let localT = constrain(map(celda.mag, THRESHOLD * 2, 600, 0, 1), 0, 1);

        auraLayer.fill(hue, lerp(60, 90, t),  lerp(70, 95, t),  localT * 7);
        auraLayer.ellipse(cx, cy, cellSize * 9,   cellSize * 9);

        auraLayer.fill(hue, lerp(70, 95, t),  lerp(75, 100, t), localT * 12);
        auraLayer.ellipse(cx, cy, cellSize * 5,   cellSize * 5);

        auraLayer.fill(hue, lerp(80, 100, t), lerp(80, 100, t), localT * 18);
        auraLayer.ellipse(cx, cy, cellSize * 2.5, cellSize * 2.5);
      }
    }
  }

  image(auraLayer, 0, 0);

  // ── partículas ────────────────────────
  t_noise += 0.0003;
  let noiseScale   = 0.0035;
  let flowStrength = 0.014;

  noStroke();
  for (let p of particles) {

    let angle = noise(
      p.x * noiseScale + p.noiseOff,
      p.y * noiseScale + p.noiseOff,
      t_noise
    ) * TWO_PI * 2;

    p.vx += cos(angle) * flowStrength;
    p.vy += sin(angle) * flowStrength;

    let col   = constrain(floor(p.x / cellSize), 0, cols - 1);
    let row   = constrain(floor(p.y / cellSize), 0, rows - 1);
    let celda = gridCurr[row * cols + col];

    if (celda.mag > THRESHOLD * 2) {
      let impulso = map(celda.mag, THRESHOLD * 2, 800, 2.0, 9.0);
      impulso = constrain(impulso, 1.2, 9.0);

      let useX = (celda.dirX !== 0 || celda.dirY !== 0) ? celda.dirX : dirGX;
      let useY = (celda.dirX !== 0 || celda.dirY !== 0) ? celda.dirY : dirGY;

      p.vx += (useX + random(-0.25, 0.25)) * impulso;
      p.vy += (useY + random(-0.25, 0.25)) * impulso;

      p.hue         = lerp(p.hue,         lerp(220, 0, t),                0.25);
      p.sat         = lerp(p.sat,         lerp(70, 100, t),               0.25);
      p.bri         = lerp(p.bri,         lerp(85, 100, t),               0.20);
      p.sizeCurrent = lerp(p.sizeCurrent, p.sizeBase * lerp(1.0, 2.2, t), 0.15);
    }

    let speed    = sqrt(p.vx * p.vx + p.vy * p.vy);
    let friction = speed > 2 ? 0.83 : 0.96;
    p.vx *= friction;
    p.vy *= friction;

    p.sat         = lerp(p.sat,         0,          0.012);
    p.bri         = lerp(p.bri,         82,         0.008);
    p.hue         = lerp(p.hue,         0,          0.010);
    p.sizeCurrent = lerp(p.sizeCurrent, p.sizeBase, 0.018);

    p.x += p.vx;
    p.y += p.vy;

    if (p.x < -10)          p.x = width  + 10;
    if (p.x > width  + 10)  p.x = -10;
    if (p.y < -10)          p.y = height + 10;
    if (p.y > height + 10)  p.y = -10;

    let alpha = map(p.sat, 0, 100, 45, 92);
    fill(p.hue, p.sat, p.bri, alpha);
    ellipse(p.x, p.y, p.sizeCurrent, p.sizeCurrent);
  }

  drawHUD();
  crearLabels();
}

// ─────────────────────────────────────────
function drawHUD() {
  let barW = 200;
  let barH = 10;
  let barX = (width - barW) / 2;
  let barY = height - 28;

  colorMode(RGB, 255);
  noStroke();
  fill(0, 0, 0, 100);
  rect(barX - 10, barY - 8, barW + 20, barH + 16, 6);

  colorMode(HSB, 360, 100, 100, 100);
  for (let i = 0; i < barW; i++) {
    let hBar = map(i, 0, barW, 220, 0);
    fill(hBar, 90, 90, 75);
    rect(barX + i, barY, 1, barH);
  }

  let indicador = constrain(map(intensidadSuavizada, 0, FAST_MIN, 0, barW), 0, barW);
  fill(0, 0, 100, 100);
  rect(barX + indicador - 2, barY - 3, 4, barH + 6, 2);

  colorMode(RGB, 255);
  textFont("monospace");
  textSize(9);
  textAlign(RIGHT);
  fill(80);
  text("fps " + round(frameRate()), width - 8, height - 6);

  textAlign(LEFT);
  colorMode(HSB, 360, 100, 100, 100);
}

// ─────────────────────────────────────────
function crearLabels() {
  if (labelsCreados) return;
  labelsCreados = true;

  let base = "color:#aaa; font-family:monospace; font-size:11px; pointer-events:none;";
  let l1 = createElement("div", "Particles");
  l1.position(20, 500);
  l1.style(base);
  let l2 = createElement("div", "Threshold");
  l2.position(220, 500);
  l2.style(base);
}