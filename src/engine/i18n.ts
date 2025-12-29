import dict from "../data/i18n.json";
export type Lang = "en"|"ru"|"uk";
export class I18n {
  lang: Lang;
  constructor(lang: Lang) { this.lang = lang; }
  t(key: string): string {
    const table = (dict as any)[this.lang] || (dict as any)["en"];
    return table?.[key] ?? key;
  }
}
