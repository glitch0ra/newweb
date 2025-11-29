document.addEventListener('DOMContentLoaded', () => {
    const loadingCanvas = document.getElementById('loading-canvas');
    if (!loadingCanvas) return console.error('Canvas #loading-canvas не найден!');

    // Явно отключаем ненужные флаги для производительности
    const gl2 = loadingCanvas.getContext('webgl2', {
        powerPreference: 'high-performance',
        preserveDrawingBuffer: false,
        alpha: true,
        depth: false,
        stencil: false,
        antialias: false,
        desynchronized: false
    });
    if (!gl2) return console.error('WebGL2 не поддерживается.');

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        loadingCanvas.width = window.innerWidth * dpr;
        loadingCanvas.height = window.innerHeight * dpr;
        gl2.viewport(0, 0, loadingCanvas.width, loadingCanvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    gl2.enable(gl2.BLEND);
    gl2.blendFunc(gl2.SRC_ALPHA, gl2.ONE_MINUS_SRC_ALPHA);

    const vertexSrc = `#version 300 es
  precision mediump float;
  layout(location = 0) in vec2 a_position;
  void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`;

    const fragmentSrc = `#version 300 es
  precision highp float;
  out vec4 fragColor;
  
  uniform vec3 iResolution;
  uniform float iTime;
  
  /*───────────────────────────────────────────────
    Вспомогательные шумы и глитч-паттерн
  ───────────────────────────────────────────────*/
  float rand(vec2 p) {
      float t = floor(iTime * 6.6) / 30.0;
      return fract(sin(dot(p, vec2(t * 12.9898, t * 78.233))) * 43758.5453);
  }
  
  float noise(vec2 uv, float blockiness) {
      vec2 lv = fract(uv);
      vec2 id = floor(uv);
      float n1 = rand(id);
      float n2 = rand(id + vec2(1,0));
      float n3 = rand(id + vec2(0,1));
      float n4 = rand(id + vec2(1,1));
      vec2 u = smoothstep(0.0, 1.0 + blockiness, lv);
      return mix(mix(n1, n2, u.x), mix(n3, n4, u.x), u.y);
  }
  
  float fbm(vec2 uv, int count, float blockiness, float complexity) {
      float val = 0.0;
      float amp = 0.5;
      while(count != 0) {
          val += amp * noise(uv + (rand(ceil(uv * 3.) / 3.) * 2.0 + (float(floor(iTime * 6.6) / 30.0)/float(count)) - 1.0), blockiness);
          amp *= 0.5;
          uv *= complexity;
          count--;
      }
      return val;
  }
  
  /*───────────────────────────────────────────────
    Иридисцентный цветовой поток
  ───────────────────────────────────────────────*/
  vec3 iridescentColor(vec2 pos, float time, float phase)
  {
      // Твои цвета
      vec3 c1 = vec3(0.0, 0.898, 1.0);   // голубой #00E5FF
      vec3 c2 = vec3(0.451, 0.0, 1.0);   // фиолетовый #7300FF
      vec3 c3 = vec3(1.0, 0.0, 0.816);   // розовый #FF00D0
      vec3 c4 = vec3(0.0, 1.0, 0.5);     // зелёный #00FF80
  
      // Равномерное вращение фазы по кругу
      float angle = time * 0.4 + pos.x * 0.2 + pos.y * 0.15 + phase * 0.8;
      float segment = fract(angle / (6.28318 / 4.0)) * 4.0;
  
      vec3 col;
      if (segment < 1.0)
          col = mix(c1, c2, smoothstep(0.0, 1.0, segment));
      else if (segment < 2.0)
          col = mix(c2, c3, smoothstep(1.0, 2.0, segment));
      else if (segment < 3.0)
          col = mix(c3, c4, smoothstep(2.0, 3.0, segment));
      else
          col = mix(c4, c1, smoothstep(3.0, 4.0, segment));
  
      // Масляный шум
      float flow = sin(pos.x * 1.1 + pos.y * 0.9 + time * 1.7 + phase) * 0.08;
      col += flow;
  
      // Сохраняем насыщенность, контролируем яркость
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(lum), col, 1.5);
      float maxVal = max(max(col.r, col.g), col.b);
      if (maxVal > 1.0) col /= (maxVal + 0.1);
      col = pow(clamp(col, 0.0, 1.0), vec3(0.95));
  
      return col;
  }
  
  /*───────────────────────────────────────────────
    Основная визуализация
  ───────────────────────────────────────────────*/
  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
      vec2 uv = fragCoord / iResolution.xy;
  
      uv *= 3.5;
      uv.x *= fbm(uv, 2, 2.5, 1.0);
      float n = fbm(uv, 2, 2.0, 1.4);
      float glitch = smoothstep(0.55, 0.8, n);
  
      float pulse = sin(iTime * 0.8 + uv.x * 8.0) * 0.5 + 0.5;
      glitch *= pow(pulse, 0.6);
  
      // === Новый цвет: вместо randomColor — живой бензиновый поток ===
      float phase = rand(floor(uv * 8.0)); // индивидуальная фаза для блоков
      vec3 color = iridescentColor(uv * 2.0, iTime, phase);
  
      // усиление интенсивности глитча
      float alpha = glitch * 1.4;
      color *= 1.3;
  
      fragColor = vec4(color * alpha, clamp(alpha, 0.0, 1.0));
  }
  
  void main() {
      vec4 c;
      mainImage(c, gl_FragCoord.xy);
      fragColor = c;
  }`;

    function compileShader(gl, type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(s));
            return null;
        }
        return s;
    }

    const vs = compileShader(gl2, gl2.VERTEX_SHADER, vertexSrc);
    const fs = compileShader(gl2, gl2.FRAGMENT_SHADER, fragmentSrc);
    const prog = gl2.createProgram();
    gl2.attachShader(prog, vs);
    gl2.attachShader(prog, fs);
    gl2.linkProgram(prog);
    if (!gl2.getProgramParameter(prog, gl2.LINK_STATUS))
        return console.error(gl2.getProgramInfoLog(prog));

    gl2.useProgram(prog);

    const quad = gl2.createBuffer();
    gl2.bindBuffer(gl2.ARRAY_BUFFER, quad);
    gl2.bufferData(gl2.ARRAY_BUFFER, new Float32Array([
        -1, -1, 1, -1, -1, 1,
        -1, 1, 1, -1, 1, 1
    ]), gl2.STATIC_DRAW);
    gl2.enableVertexAttribArray(0);
    gl2.vertexAttribPointer(0, 2, gl2.FLOAT, false, 0, 0);

    const iResolutionLoc = gl2.getUniformLocation(prog, 'iResolution');
    const iTimeLoc = gl2.getUniformLocation(prog, 'iTime');

    let start = performance.now();

    // === Пауза при невидимости ===
    let isPaused = false;
    document.addEventListener('visibilitychange', () => {
        isPaused = document.hidden;
    });
    const observer = new IntersectionObserver((entries) => {
        isPaused = !entries[0].isIntersecting;
    }, {
        threshold: 0.05
    });
    observer.observe(loadingCanvas);

    // === Фиксированный FPS = 20 ===
    const FPS = 20;
    const FRAME_INTERVAL = 1000 / FPS;
    let lastRenderTime = 0;

    function render(now) {
        if (isPaused) {
            requestAnimationFrame(render);
            return;
        }

        if (now - lastRenderTime < FRAME_INTERVAL) {
            requestAnimationFrame(render);
            return;
        }

        lastRenderTime = now;
        resize();
        const t = ((now - start) * 0.001) % 300;
        gl2.uniform3f(iResolutionLoc, loadingCanvas.width, loadingCanvas.height, 1.0);
        const acceleratedTime = t * 1.2;
        gl2.uniform1f(iTimeLoc, acceleratedTime);
        gl2.drawArrays(gl2.TRIANGLES, 0, 6);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
});