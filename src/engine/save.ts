export type SaveData = {
  coins: number;
  lang: "en"|"ru"|"uk";
  mode: "acro"|"angle";
  ownedDrones: Record<string, boolean>;
  ownedMaps: Record<string, boolean>;
  selectedDroneId: string;
  selectedMapId: string;
};

const KEY = "fpv_customengine_m5_save";

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) throw new Error("no save");
    return JSON.parse(raw) as SaveData;
  } catch {
    return {
      coins: 0,
      lang: "ru",
      mode: "acro",
      ownedDrones: { "armed_1": true },
      ownedMaps: { "map1": true, "map2": true },
      selectedDroneId: "armed_1",
      selectedMapId: "map1",
    };
  }
}

export function save(d: SaveData) {
  localStorage.setItem(KEY, JSON.stringify(d));
}
