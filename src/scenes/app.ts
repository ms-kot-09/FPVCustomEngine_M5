import drones from "../data/drones.json";
import maps from "../data/maps.json";
import { I18n, Lang } from "../engine/i18n";
import { loadSave, save, SaveData } from "../engine/save";
import { createInput } from "../engine/input";
import { World } from "../game/world";
import { Renderer } from "../game/renderer";

type DroneDef = (typeof drones)[number];
type MapDef = (typeof maps)[number];

export class App {
  save: SaveData = loadSave();
  i18n = new I18n(this.save.lang);
  input = createInput();
  canvas = document.getElementById("c") as HTMLCanvasElement;
  renderer = new Renderer(this.canvas);
  world: World | null = null;

  menu = document.getElementById("menu")!;
  hud = document.getElementById("hud")!;
  mapsLayer = document.getElementById("maps")!;
  shopLayer = document.getElementById("shop")!;
  settingsLayer = document.getElementById("settings")!;

  btnPlayImg = document.getElementById("btnPlayImg") as HTMLImageElement;
  btnMapsImg = document.getElementById("btnMapsImg") as HTMLImageElement;
  btnShopImg = document.getElementById("btnShopImg") as HTMLImageElement;
  btnSettingsImg = document.getElementById("btnSettingsImg") as HTMLImageElement;

  coinsHud = document.getElementById("coinsHud")!;
  droneHud = document.getElementById("droneHud")!;
  modeHud = document.getElementById("modeHud")!;
  fireBtn = document.getElementById("fireBtn")!;

  mapsList = document.getElementById("mapsList")!;
  dronesList = document.getElementById("dronesList")!;
  coinsTop = document.getElementById("coinsTop")!;
  coinsShop = document.getElementById("coinsShop")!;

  modeSelect = document.getElementById("modeSelect") as HTMLSelectElement;
  langSelect = document.getElementById("langSelect") as HTMLSelectElement;
  gpState = document.getElementById("gpState")!;

  title = document.getElementById("title")!;
  mapsTitle = document.getElementById("mapsTitle")!;
  shopTitle = document.getElementById("shopTitle")!;
  settingsTitle = document.getElementById("settingsTitle")!;
  modeLabel = document.getElementById("modeLabel")!;
  langLabel = document.getElementById("langLabel")!;
  gpLabel = document.getElementById("gpLabel")!;

  constructor() {
    this.btnPlayImg.addEventListener("pointerdown", () => this.startGame());
    this.btnMapsImg.addEventListener("pointerdown", () => this.openMaps());
    this.btnShopImg.addEventListener("pointerdown", () => this.openShop());
    this.btnSettingsImg.addEventListener("pointerdown", () => this.openSettings());

    document.getElementById("mapsBack")!.addEventListener("pointerdown", () => this.showMenu());
    document.getElementById("shopBack")!.addEventListener("pointerdown", () => this.showMenu());
    document.getElementById("settingsBack")!.addEventListener("pointerdown", () => this.showMenu());

    this.modeSelect.value = this.save.mode;
    this.langSelect.value = this.save.lang;
    this.modeSelect.addEventListener("change", () => { this.save.mode = this.modeSelect.value as any; this.persist(); this.applyTexts(); });
    this.langSelect.addEventListener("change", () => { this.setLang(this.langSelect.value as any); });

    this.applyTexts();
    this.refreshLists();

    let last = performance.now();
    const loop = (now:number) => {
      const dt = Math.min(0.033, (now-last)/1000);
      last = now;

      const gp = this.input.getGamepad();
      this.gpState.textContent = gp ? (this.i18n.t("gamepad_detected") + ": " + (gp.id || "Gamepad")) : "—";

      if (this.world) {
        const input = this.input.sample();
        if (input.pause) this.showMenu();
        this.world.step(dt, input);
        this.save.coins = this.world.coins;
        this.coinsHud.textContent = this.i18n.t("coins") + ": " + this.save.coins;
        this.droneHud.textContent = this.i18n.t("drone") + ": " + this.world.drone.name;
        this.modeHud.textContent = this.i18n.t(this.save.mode);
        this.renderer.frame(this.world);
        this.persist(false);
      } else {
        const tmpDrone = this.getSelectedDrone();
        const tmpMap = this.getSelectedMap();
        const w = new World(tmpDrone as any, tmpMap as any, this.save.mode);
        w.coins = this.save.coins;
        w.step(dt, { left:{x:0,y:0,active:false}, right:{x:0,y:0,active:false}, fire:false, pause:false });
        this.renderer.frame(w);
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  setLang(lang:Lang) {
    this.save.lang = lang;
    this.i18n.lang = lang;
    this.persist();
    this.applyTexts();
    this.refreshLists();
  }

  applyTexts() {
    this.title.textContent = this.i18n.t("title");
    this.mapsTitle.textContent = this.i18n.t("maps");
    this.shopTitle.textContent = this.i18n.t("shop");
    this.settingsTitle.textContent = this.i18n.t("settings");
    this.modeLabel.textContent = this.i18n.t("mode");
    this.langLabel.textContent = this.i18n.t("language");
    this.gpLabel.textContent = this.i18n.t("gamepad");
    this.fireBtn.textContent = this.i18n.t("fire");

    const L = this.save.lang;
    this.btnPlayImg.src = `/ui/${L}/btn_play.svg`;
    this.btnMapsImg.src = `/ui/${L}/btn_maps.svg`;
    this.btnShopImg.src = `/ui/${L}/btn_shop.svg`;
    this.btnSettingsImg.src = `/ui/${L}/btn_settings.svg`;
  }

  persist(refresh=true) {
    save(this.save);
    if (refresh) this.refreshLists();
  }

  getSelectedDrone(): DroneDef {
    return (drones as any as DroneDef[]).find(x => x.id === this.save.selectedDroneId) || (drones as any as DroneDef[])[0];
  }
  getSelectedMap(): MapDef {
    return (maps as any as MapDef[]).find(x => x.id === this.save.selectedMapId) || (maps as any as MapDef[])[0];
  }

  showMenu() {
    this.world = null;
    this.hud.classList.add("hidden");
    this.mapsLayer.classList.add("hidden");
    this.shopLayer.classList.add("hidden");
    this.settingsLayer.classList.add("hidden");
    this.menu.classList.remove("hidden");
  }

  startGame() {
    const d = this.getSelectedDrone();
    const m = this.getSelectedMap();
    if (!this.save.ownedMaps[m.id] && m.cost > 0) { alert(this.i18n.t("map_locked")); return; }
    if (!this.save.ownedDrones[d.id] && d.cost > 0) { alert(this.i18n.t("drone_locked")); return; }

    this.menu.classList.add("hidden");
    this.mapsLayer.classList.add("hidden");
    this.shopLayer.classList.add("hidden");
    this.settingsLayer.classList.add("hidden");
    this.hud.classList.remove("hidden");

    this.world = new World(d as any, m as any, this.save.mode);
    this.world.coins = this.save.coins;
  }

  openMaps() {
    this.menu.classList.add("hidden");
    this.mapsLayer.classList.remove("hidden");
    this.shopLayer.classList.add("hidden");
    this.settingsLayer.classList.add("hidden");
    this.hud.classList.add("hidden");
    this.refreshLists();
  }

  openShop() {
    this.menu.classList.add("hidden");
    this.mapsLayer.classList.add("hidden");
    this.shopLayer.classList.remove("hidden");
    this.settingsLayer.classList.add("hidden");
    this.hud.classList.add("hidden");
    this.refreshLists();
  }

  openSettings() {
    this.menu.classList.add("hidden");
    this.mapsLayer.classList.add("hidden");
    this.shopLayer.classList.add("hidden");
    this.settingsLayer.classList.remove("hidden");
    this.hud.classList.add("hidden");
    this.modeSelect.value = this.save.mode;
    this.langSelect.value = this.save.lang;
  }

  refreshLists() {
    this.coinsTop.textContent = this.i18n.t("coins") + ": " + this.save.coins;
    this.coinsShop.textContent = this.i18n.t("coins") + ": " + this.save.coins;

    this.mapsList.innerHTML = "";
    (maps as any as MapDef[]).forEach(m => {
      const owned = this.save.ownedMaps[m.id] || m.cost === 0;
      const row = document.createElement("div");
      row.className = "row";
      row.style.padding = "8px 0";
      row.style.borderBottom = "1px solid rgba(255,255,255,0.08)";
      const left = document.createElement("div");
      left.innerHTML = `<div style="font-weight:800">${m.name}</div><div class="small">${owned ? this.i18n.t("owned") : (this.i18n.t("locked") + " • " + m.cost)}</div>`;
      const right = document.createElement("div");
      right.className = "btn";
      right.style.width = "120px";
      right.style.height = "42px";
      right.textContent = owned ? "Select" : this.i18n.t("buy");
      right.addEventListener("pointerdown", () => {
        if (!owned) {
          if (this.save.coins >= m.cost) {
            this.save.coins -= m.cost;
            this.save.ownedMaps[m.id] = true;
            this.persist();
          } else return;
        }
        this.save.selectedMapId = m.id;
        this.persist();
      });
      row.appendChild(left); row.appendChild(right);
      this.mapsList.appendChild(row);
    });

    this.dronesList.innerHTML = "";
    (drones as any as DroneDef[]).forEach(d => {
      const owned = this.save.ownedDrones[d.id] || d.cost === 0;
      const row = document.createElement("div");
      row.className = "row";
      row.style.padding = "8px 0";
      row.style.borderBottom = "1px solid rgba(255,255,255,0.08)";
      const left = document.createElement("div");
      left.innerHTML = `<div style="font-weight:800">${d.name}</div><div class="small">${d.type.toUpperCase()} • ${owned ? this.i18n.t("owned") : (this.i18n.t("locked") + " • " + d.cost)}</div>`;
      const right = document.createElement("div");
      right.className = "btn";
      right.style.width = "120px";
      right.style.height = "42px";
      right.textContent = owned ? "Select" : this.i18n.t("buy");
      right.addEventListener("pointerdown", () => {
        if (!owned) {
          if (this.save.coins >= d.cost) {
            this.save.coins -= d.cost;
            this.save.ownedDrones[d.id] = true;
            this.persist();
          } else return;
        }
        this.save.selectedDroneId = d.id;
        this.persist();
      });
      row.appendChild(left); row.appendChild(right);
      this.dronesList.appendChild(row);
    });
  }
}
