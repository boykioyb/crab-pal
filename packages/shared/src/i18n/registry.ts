import type { Locale } from "date-fns";
import enMessages from "./locales/en.json";
import esMessages from "./locales/es.json";
import zhHansMessages from "./locales/zh-Hans.json";
import jaMessages from "./locales/ja.json";
import huMessages from "./locales/hu.json";
import deMessages from "./locales/de.json";
import plMessages from "./locales/pl.json";
import { enUS } from "date-fns/locale/en-US";
import { es as esDateLocale } from "date-fns/locale/es";
import { zhCN } from "date-fns/locale/zh-CN";
import { ja as jaDateLocale } from "date-fns/locale/ja";
import { hu as huDateLocale } from "date-fns/locale/hu";
import { de as deDateLocale } from "date-fns/locale/de";
import { pl as plDateLocale } from "date-fns/locale/pl";

interface LocaleEntry {
  nativeName: string;
  messages: Record<string, string>;
  dateLocale: Locale;
}

export const LOCALE_REGISTRY = {
  en: { nativeName: "English", messages: enMessages, dateLocale: enUS },
  es: { nativeName: "Español", messages: esMessages, dateLocale: esDateLocale },
  "zh-Hans": {
    nativeName: "简体中文",
    messages: zhHansMessages,
    dateLocale: zhCN,
  },
  ja: { nativeName: "日本語", messages: jaMessages, dateLocale: jaDateLocale },
  hu: { nativeName: "Magyar", messages: huMessages, dateLocale: huDateLocale },
  de: { nativeName: "Deutsch", messages: deMessages, dateLocale: deDateLocale },
  pl: { nativeName: "Polski", messages: plMessages, dateLocale: plDateLocale },
} satisfies Record<string, LocaleEntry>;

export type LanguageCode = keyof typeof LOCALE_REGISTRY;
