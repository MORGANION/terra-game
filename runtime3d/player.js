// Игрок: контроллер от 3-го лица по карте высот, камера-орбита, ввод (клавиатура + тач-джойстик + свайп камеры).
import * as THREE from 'three';

export class Input {
  constructor(dom) {
    this.keys = {};
    this.move = new THREE.Vector2();   // x — вправо, y — вперёд
    this.look = new THREE.Vector2();   // накопленный поворот камеры (пиксели)
    this.jump = false; this.run = false; this.act = false;
    this.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    addEventListener('keydown', e => { if (e.metaKey && e.code !== 'MetaLeft' && e.code !== 'MetaRight') return; this.keys[e.code] = true; if (e.code === 'Space') this.jump = true; if (e.code === 'KeyE') this.act = true; });
    addEventListener('keyup', e => { this.keys[e.code] = false; if (e.key === 'Meta' || e.key === 'Alt' || e.key === 'Control') this.clearKeys(); });
    addEventListener('blur', () => this.clearKeys());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clearKeys(); });
    addEventListener('contextmenu', () => this.clearKeys());
    // Мышь: зажатая ЛКМ/ПКМ на канвасе крутит камеру
    let drag = null;
    dom.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') { drag = { x: e.clientX, y: e.clientY }; dom.setPointerCapture(e.pointerId); } });
    dom.addEventListener('pointermove', e => { if (drag && e.pointerType === 'mouse') { this.look.x += e.clientX - drag.x; this.look.y += e.clientY - drag.y; drag = { x: e.clientX, y: e.clientY }; } });
    dom.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') drag = null; });
    dom.addEventListener('lostpointercapture', () => { drag = null; });
    addEventListener('blur', () => { drag = null; this.look.set(0, 0); });
    dom.addEventListener('pointermove', e => { if (drag && e.pointerType === 'mouse' && e.buttons === 0) drag = null; });
    dom.addEventListener('wheel', e => { this.zoom = (this.zoom || 0) + Math.sign(e.deltaY); }, { passive: true });
    this.buildTouch(dom);
  }
  buildTouch(dom) {
    // Левая половина — джойстик, правая — поворот камеры
    const stick = document.getElementById('stick'), knob = document.getElementById('knob');
    const st = { id: null, cx: 0, cy: 0 }, cam = { id: null, x: 0, y: 0 };
    dom.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth * 0.45 && st.id === null) {
          st.id = t.identifier; st.cx = t.clientX; st.cy = t.clientY;
          stick.style.display = 'block'; stick.style.left = t.clientX - 60 + 'px'; stick.style.top = t.clientY - 60 + 'px';
          knob.style.transform = 'translate(0px,0px)';
        } else if (cam.id === null) { cam.id = t.identifier; cam.x = t.clientX; cam.y = t.clientY; }
      }
      e.preventDefault();
    }, { passive: false });
    dom.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === st.id) {
          let dx = t.clientX - st.cx, dy = t.clientY - st.cy; const l = Math.hypot(dx, dy), m = 55;
          if (l > m) { dx *= m / l; dy *= m / l; }
          knob.style.transform = `translate(${dx}px,${dy}px)`;
          this.move.set(dx / m, -dy / m);
          this.run = l > m * 0.95;
        } else if (t.identifier === cam.id) { this.look.x += (t.clientX - cam.x) * 1.4; this.look.y += (t.clientY - cam.y) * 1.4; cam.x = t.clientX; cam.y = t.clientY; }
      }
      e.preventDefault();
    }, { passive: false });
    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === st.id) { st.id = null; this.move.set(0, 0); this.run = false; stick.style.display = 'none'; }
        if (t.identifier === cam.id) cam.id = null;
      }
    };
    dom.addEventListener('touchend', end); dom.addEventListener('touchcancel', end);
  }
  poll() {
    if (!this.touch || Object.values(this.keys).some(Boolean)) {
      const k = this.keys;
      const x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
      const y = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
      if (x || y || !this.touch) { this.move.set(x, y); if (this.move.lengthSq() > 1) this.move.normalize(); }
      this.run = !!k.ShiftLeft || this.run && this.touch;
    }
  }
  clearKeys() { for (const k in this.keys) this.keys[k] = false; this.move.set(0, 0); this.run = false; this.jetHeld = false; }
  // Бот/скрипт управления
  setBot(move, run = false) { this.move.copy(move); this.run = run; }
}

export class Player {
  constructor(scene, world, models, cfg, input, char = null) {
    this.world = world; this.cfg = cfg.player; this.input = input; this.scene = scene;
    this.obj = new THREE.Group();
    this.char = char;
    this.model = char ? char.root : models.instance('astronaut', { animated: true });
    this.obj.add(this.model);
    this.obj.name = 'player';
    scene.add(this.obj);
    this.parts = {};
    for (const n of ['legL', 'legR', 'armL', 'armR', 'head', 'body']) this.parts[n] = this.model.getObjectByName(n);
    this.pos = new THREE.Vector3(...cfg.world.spawn);
    this.pos.y = world.heightAt(this.pos.x, this.pos.z);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;         // направление камеры
    this.pitch = 0.42;
    this.dist = 9;
    this.facing = Math.PI;
    this.grounded = true;
    this.walkPhase = 0;
    this.speedNow = 0;
    this.blockedBy = null;
    this.mining = 0;
    this.solids = [];           // круглые препятствия {x,z,r}
  }
  addSolid(x, z, r) { this.solids.push({ x, z, r }); }

  // Поза сидя (вождение): после idle разворачиваем кости ног в мировых направлениях — бедро вперёд, голень вниз (не зависит от осей рига)
  sitPose(c) {
    const find = n => c.model.getObjectByName('mixamorig' + n) || c.model.getObjectByName('mixamorig:' + n);
    const L = this._sitBones ||= ['Left', 'Right'].map(s => [find(s + 'UpLeg'), find(s + 'Leg'), find(s + 'Foot')]);
    const A = this._sitArms ||= ['Left', 'Right'].map(s => [find(s + 'Arm'), find(s + 'ForeArm'), find(s + 'Hand'), s === 'Left' ? 1 : -1]);
    const V = THREE.Vector3, oq = this.obj.quaternion, f = new V(0, 0, 1).applyQuaternion(oq), dn = new V(0, -1, 0).applyQuaternion(oq);   // оси машины (на склоне ноги наклоняются вместе с ней)
    const thighDir = f.clone().multiplyScalar(0.97).addScaledVector(dn, 0.22).normalize(), shinDir = f.clone().multiplyScalar(-0.1).add(dn).normalize();
    const aim = (bone, child, dir) => { if (!bone || !child) return; bone.updateWorldMatrix(true, true);
      const a = bone.getWorldPosition(new V()), cur = child.getWorldPosition(new V()).sub(a).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(cur, dir), wq = bone.getWorldQuaternion(new THREE.Quaternion()), pq = bone.parent.getWorldQuaternion(new THREE.Quaternion());
      bone.quaternion.copy(pq.invert().multiply(q.multiply(wq))); };
    for (const [up, low, foot] of L) { aim(up, low, thighDir); aim(low, foot, shinDir); }
    // руки на руль: двухкостный IK (плечо–локоть–кисть) к точкам обода руля в системе машины
    const V0 = this.driving, W = V0?.cfg?.wheel;
    if (V0 && W) {
      const [wx, wy, wz] = W.at, gr = W.grip ?? 0.11, M = V0.obj.matrixWorld;
      const side = new V(1, 0, 0).applyQuaternion(V0.obj.quaternion);
      for (const [arm, fore, hand, sg] of A) {
        if (!arm || !fore || !hand) continue;
        // левая рука — на левую сторону обода (в системе машины +x — левый борт при взгляде вперёд по +z)
        // точка хвата на ободе (9 и 3 часа); кисть-кость = запястье, отводим её от обода против направления пальцев
        const fing = hand.children.find(o => /Middle1|Index1/.test(o.name)) || hand.children[0];
        const fDir = f.clone().multiplyScalar(0.35).addScaledVector(dn, -0.93).addScaledVector(side, -sg * 0.08).normalize();   // пальцы вверх по касательной к ободу (хват на 9 и 3)
        const palm = fing ? hand.getWorldPosition(new V()).distanceTo(fing.getWorldPosition(new V())) : 0.08;
        const T = new V(wx + sg * gr, wy, wz).applyMatrix4(M).addScaledVector(fDir, -palm * 0.9).addScaledVector(f, -0.03).addScaledVector(side, sg * 0.03);
        arm.updateWorldMatrix(true, true);
        const S = arm.getWorldPosition(new V()), Ep = fore.getWorldPosition(new V()), Hp = hand.getWorldPosition(new V());
        const a = S.distanceTo(Ep), b = Ep.distanceTo(Hp), toT = T.clone().sub(S); let d = toT.length();
        d = Math.min(Math.max(d, Math.abs(a - b) + 1e-3), a + b - 1e-3); const dir = toT.normalize();
        // полюс локтя: вниз и наружу
        const pole = dn.clone().addScaledVector(side, sg * 0.25).addScaledVector(dir, -dir.dot(dn.clone().addScaledVector(side, sg * 0.25))).normalize();
        const ca = (a * a + d * d - b * b) / (2 * a * d), sa = Math.sqrt(Math.max(0, 1 - ca * ca));
        const E = S.clone().addScaledVector(dir, ca * a).addScaledVector(pole, sa * a);
        aim(arm, fore, E.clone().sub(S).normalize()); fore.updateWorldMatrix(true, true);
        aim(fore, hand, T.clone().sub(fore.getWorldPosition(new V())).normalize());
        if (fing) aim(hand, fing, fDir);
      }
    }
  }
  update(dt, camera, frozen = false) {
    const inp = this.input;
    inp.poll();
    if (frozen) { inp.move.set(0, 0); inp.jump = false; inp.run = false; this.vel.x = this.vel.z = 0; }
    const drivingMove = this.driving ? inp.move.clone() : null; if (this.driving) { inp.move.set(0, 0); inp.jump = false; }
    // Камера
    // Камера: накопленный за кадр сдвиг мыши/пальца применяем и СРАЗУ обнуляем (иначе камера крутится сама)
    this.yaw -= THREE.MathUtils.clamp(inp.look.x, -120, 120) * 0.005;
    this.pitch = THREE.MathUtils.clamp(this.pitch + THREE.MathUtils.clamp(inp.look.y, -80, 80) * 0.004, -1.2, 1.2);   // вниз-вверх: почти всё небо
    inp.look.set(0, 0);
    if (inp.zoom) { this.dist = THREE.MathUtils.clamp(this.dist + inp.zoom * 0.8, 5, 18); inp.zoom = 0; }
    if (drivingMove) { this._dm = drivingMove; }
    // Движение относительно камеры
    const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3().addScaledVector(right, inp.move.x).addScaledVector(fwd, inp.move.y);
    const amt = Math.min(1, wish.length());
    const speed = (inp.run ? this.cfg.run : this.cfg.walk) * (this.speedMul || 1) * (this.mining > 0 ? 0 : 1);
    if (amt > 0.05) {
      wish.normalize();
      this.facing = Math.atan2(wish.x, wish.z);
      // В воде медленнее
      const inWater = this.pos.y < this.world.waterAt(this.pos.x, this.pos.z) - 0.4;
      const sp = speed * amt * (inWater ? 0.55 : 1);
      // Склон: круто вверх — не пройти
      const nx = this.pos.x + wish.x * sp * dt, nz = this.pos.z + wish.z * sp * dt;
      const gAt = (x, z) => { const h = this.world.heightAt(x, z); return this.groundAt ? this.groundAt(x, z, h) : h; };
      // Отвесный уступ: смотрим на 0.45 м вперёд. Выше колена (0.5 м над ногами) и круче ~48° — пешком не пройти.
      const wall = (x, z) => { const L = 0.45, ax = x + wish.x * L, az = z + wish.z * L, gN = gAt(ax, az); return gN - this.pos.y > 0.5 && (gN - gAt(x, z)) / L > 1.1; };
      const steep = wall(this.pos.x, this.pos.z);
      const gate = this.world.blocked(nx, nz);
      this.blockedBy = gate;
      let mx = nx, mz = nz;
      if (steep) { const sx = this.pos.x + wish.x * sp * dt, sz = this.pos.z + wish.z * sp * dt; const dxOk = Math.abs(wish.x) > 0.3 && !(gAt(sx + Math.sign(wish.x) * 0.45, this.pos.z) - this.pos.y > 0.5), dzOk = Math.abs(wish.z) > 0.3 && !(gAt(this.pos.x, sz + Math.sign(wish.z) * 0.45) - this.pos.y > 0.5); mx = dxOk ? sx : this.pos.x; mz = dzOk ? sz : this.pos.z; }
      if ((!steep || mx !== this.pos.x || mz !== this.pos.z) && !gate) {
        let px = mx, pz = mz;
        for (const s of this.solids) {
          const dx = px - s.x, dz = pz - s.z, d = Math.hypot(dx, dz), r = s.r + 0.35;
          if (d < r && d > 0.0001) { px = s.x + dx / d * r; pz = s.z + dz / d * r; }
        }
        if (this.collide) { const q = { x: px, z: pz }; this.collide(q); px = q.x; pz = q.z; }
        const lim = this.world.half * 0.86;
        this.pos.x = THREE.MathUtils.clamp(px, -lim, lim); this.pos.z = THREE.MathUtils.clamp(pz, -lim, lim);
      }
      this.speedNow = sp;
    } else { this.speedNow = 0; this.blockedBy = null; }
    // Прыжок и гравитация
    const gh0 = this.world.heightAt(this.pos.x, this.pos.z), ground = this.groundAt ? this.groundAt(this.pos.x, this.pos.z, gh0) : gh0;
    if (inp.jump && this.grounded) { this.vel.y = this.cfg.jump; this.grounded = false; this.baseY = this.pos.y; }
    inp.jump = false;
    // Джетпак: любой поднимает до jet_height над точкой отрыва; уровень (jetFuelMax, с) — сколько секунд держит тягу/зависание.
    // Держи пробел в воздухе: набор высоты, у потолка — зависание; топливо (с) восполняется на земле.
    const JM = this.jetFuelMax || 0, JH = this.cfg.jet_height || 3;
    if (this.grounded) { this.baseY = this.pos.y; this.jetFuel = Math.min(JM, (this.jetFuel ?? JM) + dt * Math.max(1, JM)); }
    else if (this.baseY == null) this.baseY = this.pos.y;
    const ceilY = (this.baseY ?? this.pos.y) + JH;
    this.jetting = !this.grounded && JM > 0 && (inp.keys.Space || inp.jetHeld) && this.jetFuel > 0;
    if (this.jetting) {
      this.jetUsed = true;   // в этом прыжке был джетпак — урона от падения не будет
      this.jetFuel = Math.max(0, this.jetFuel - dt);
      const want = Math.min(7, Math.max(0, (ceilY - this.pos.y) * 4));     // к потолку — плавно, у потолка — висим
      this.vel.y += (want - this.vel.y) * Math.min(1, dt * 8) + this.cfg.gravity * dt;
    }
    this.vel.y -= this.cfg.gravity * dt;
    this.pos.y += this.vel.y * dt;
    const ceil = this.ceilAt?.(this.pos.x, this.pos.z, this.pos.y); if (ceil != null && this.pos.y + 1.75 > ceil) { this.pos.y = ceil - 1.75; if (this.vel.y > 0) this.vel.y = 0; }
    this.landingSpeed = 0;
    if (this.noFall > 0) this.noFall -= dt;
    if (!this.grounded) this.airTop = Math.max(this.airTop ?? this.pos.y, this.pos.y); else { this.airTop = this.pos.y; this.jetUsed = false; }
    if (this.pos.y <= ground) { if (!this.grounded) { this.landedFrom = this.jetUsed || this.noFall > 0 ? 0 : (this.airTop ?? ground) - ground; this.airTop = ground; this.jetUsed = false; } if (!this.grounded) this.landingSpeed = this.jetFuelMax ? Math.min(-this.vel.y, 10) : -this.vel.y; this.pos.y = ground; this.vel.y = 0; this.grounded = true; }
    // Выхлоп джетпака: два факела из сопел ранца + дым-частицы
    if (!this.jetFx) {
      const fx = this.jetFx = { flames: [], parts: [], k: 0 };
      const fm = new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      for (const sx of [-0.24, 0.24]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.9, 8, 1, true), fm); c.rotation.x = Math.PI; c.position.set(sx, 0.55, -0.4); const core = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5, 6, 1, true), new THREE.MeshBasicMaterial({ color: '#fff6d0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); core.position.y = 0.1; c.add(core); c.visible = false; this.obj.add(c); fx.flames.push(c); }
      const pm = new THREE.MeshBasicMaterial({ color: '#eeeae4', transparent: true, opacity: 0.5, depthWrite: false });
      for (let i = 0; i < 28; i++) { const q = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), pm.clone()); q.visible = false; q.userData.life = 0; this.scene.add(q); fx.parts.push(q); }
      fx.light = new THREE.PointLight('#ffa040', 0, 6, 1.6); fx.light.position.set(0, 0.6, -0.35); this.obj.add(fx.light);
    }
    // Круглая тень на земле под героем в воздухе — видно высоту полёта
    if (!this.blob) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); this.blob.rotation.x = -Math.PI / 2; this.scene.add(this.blob); }
    { const gy = this.groundAt ? this.groundAt(this.pos.x, this.pos.z, this.world.heightAt(this.pos.x, this.pos.z)) : this.world.heightAt(this.pos.x, this.pos.z), h = this.pos.y - gy;
      this.blob.visible = h > 0.25; this.blob.position.set(this.pos.x, gy + 0.05, this.pos.z); this.blob.scale.setScalar(Math.max(0.5, 1 - h * 0.08)); this.blob.material.opacity = Math.max(0.25, 1 - h * 0.12); }
    { const fx = this.jetFx; fx.k += ((this.jetting ? 1 : 0) - fx.k) * Math.min(1, dt * 14);
      for (const c of fx.flames) { c.visible = fx.k > 0.05; c.scale.set(1, 0.6 + fx.k * (0.8 + Math.random() * 0.5), 1); c.material.opacity = 0.9 * fx.k; }
      fx.light.intensity = fx.k * (30 + Math.random() * 12);
      fx.emit = (fx.emit || 0) + dt * 40 * (this.jetting ? 1 : 0);
      while (fx.emit > 1) { fx.emit--; const q = fx.parts.find(p => p.userData.life <= 0); if (!q) break; const f = this.forward(), sx = (Math.random() < 0.5 ? -0.24 : 0.24);
        q.position.set(this.pos.x - f.x * 0.35 + f.z * sx, this.pos.y + 0.45, this.pos.z - f.z * 0.35 - f.x * sx); q.userData.v = new THREE.Vector3((Math.random() - 0.5) * 0.8, -3 - Math.random() * 2, (Math.random() - 0.5) * 0.8); q.userData.life = 0.6 + Math.random() * 0.3; q.visible = true; q.scale.setScalar(0.6); }
      for (const q of fx.parts) { if (q.userData.life <= 0) continue; q.userData.life -= dt; q.position.addScaledVector(q.userData.v, dt); q.userData.v.multiplyScalar(1 - dt * 2.5); q.userData.v.y += dt * 1.5; q.scale.multiplyScalar(1 + dt * 2.2); q.material.opacity = Math.max(0, q.userData.life) * 0.7; q.material.color.setHSL(0.08, 0.15 + q.userData.life * 0.6, 0.55 + q.userData.life * 0.3); if (q.userData.life <= 0) q.visible = false; } }
    // Модель
    if (this.driving && this._seat) { this.pos.copy(this._seat); this.vel.set(0, 0, 0); this.grounded = true; }   // физика пешехода не двигает сидящего
    this.obj.position.copy(this.pos); if (!this.driving && (this.obj.rotation.x || this.obj.rotation.z)) { this.obj.rotation.x = 0; this.obj.rotation.z = 0; }
    if (!this._lockRot) { let d = this.facing - this.obj.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); this.obj.rotation.y += d * Math.min(1, dt * 12); }
    // Скелетная анимация (Tripo GLB)
    if (this.char) {
      const A = this.char.anims, c = this.char;
      const want = this.dying ? A.fall : this.mining > 0 ? A.mine : !this.grounded ? (this.vel.y > 0 ? A.jump : A.fall) : this.speedNow > (this.cfg.walk + this.cfg.run) / 2 ? A.run : this.speedNow > 0.3 ? A.walk : (this.emote && this.emote.t > 0 ? this.emote.name : A.idle);
      if (this.emote) this.emote.t -= dt;
      if (this.dying) { this.dying += dt; const k = Math.min(1, this.dying / 0.9); c.root.rotation.x = -k * 1.35; c.root.position.y = -k * 0.35; } else if (c.root.rotation.x) { c.root.rotation.x = 0; c.root.position.y = 0; }
      const sp = want === A.walk ? this.speedNow / this.cfg.walk : want === A.run ? this.speedNow / this.cfg.run : 1;
      c.play(this.driving ? A.idle : want, { speed: this.driving ? 1 : Math.max(0.6, Math.min(1.6, sp)) });
      c.update(dt);
      if (this.driving) this.sitPose(c); // поза сидя поверх idle: бёдра вперёд, колени согнуты
    }
    // Анимация ходьбы / добычи (процедурная модель)
    this.walkPhase += dt * this.speedNow * 1.6;
    const sw = Math.sin(this.walkPhase) * Math.min(1, this.speedNow / 4) * 0.7;
    if (this.parts.legL) this.parts.legL.rotation.x = sw;
    if (this.parts.legR) this.parts.legR.rotation.x = -sw;
    if (this.mining > 0) {
      const m = Math.sin(performance.now() / 70) * 0.5;
      if (this.parts.armR) this.parts.armR.rotation.x = -1.3 + m;
      if (this.parts.armL) this.parts.armL.rotation.x = -1.1 - m;
    } else {
      if (this.parts.armL) this.parts.armL.rotation.x = -sw * 0.8;
      if (this.parts.armR) this.parts.armR.rotation.x = sw * 0.8;
    }
    if (!this.char) this.model.position.y = this.grounded ? Math.abs(Math.sin(this.walkPhase)) * 0.06 * Math.min(1, this.speedNow / 4) : 0;
    // Камера для съёмки/катсцен: фиксированная точка и цель
    if (this.camOverride) { camera.position.copy(this.camOverride.pos); camera.lookAt(this.camOverride.target); return; }
    // Камера: орбита, не уходит под землю
    const target = this.pos.clone().add(new THREE.Vector3(0, 1.5, 0));
    this.camDist = (this.camDist ?? this.dist) + ((this.indoor ? Math.min(this.dist, 3.6) : this.dist) - (this.camDist ?? this.dist)) * Math.min(1, dt * 3);
    // pitch > 0 — камера сверху; pitch < 0 — камера опускается к земле и смотрит в небо (весь купол неба доступен)
    const pt = this.pitch, low = Math.max(0, -pt), pc = Math.max(pt, 0.05);
    const dist = this.camDist * (1 - low * 0.45);
    const cp = target.clone().add(new THREE.Vector3(Math.sin(this.yaw) * Math.cos(pc), Math.sin(pc), Math.cos(this.yaw) * Math.cos(pc)).multiplyScalar(dist));
    const gh = this.world.heightAt(cp.x, cp.z) + 0.6;
    if (cp.y < gh) cp.y = gh;
    camera.position.lerp(cp, Math.min(1, dt * (this.driving ? 30 : 10)));
    // взгляд: цель поднимается вверх над героем пропорционально наклону
    if (low > 0) {
      const el = Math.min(1.25, low * 1.05), fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      const base = camera.position.clone().lerp(target, 0.5);   // плавный переход из «смотрю на героя» в «смотрю в небо»
      const look = new THREE.Vector3(fx * Math.cos(el), Math.sin(el), fz * Math.cos(el)).multiplyScalar(20).add(low < 0.25 ? target.clone().lerp(base, low * 4) : base);
      camera.up.set(0, 1, 0); camera.lookAt(low < 0.25 ? target.clone().lerp(look, low * 4) : look);
    } else camera.lookAt(target);
  }
  // Телепорт/респавн/загрузка: высоту падения не считать (иначе урон «из ниоткуда»)
  resetFall(sec = 1.5) { this.airTop = null; this.landedFrom = 0; this.jetUsed = false; this.vel.y = 0; this.noFall = sec; }
  emoteOnce(kind, sec = 2.5) { if (this.char?.anims[kind]) this.emote = { name: this.char.anims[kind], t: sec }; }
  forward() { return new THREE.Vector3(Math.sin(this.obj.rotation.y), 0, Math.cos(this.obj.rotation.y)); }
}
