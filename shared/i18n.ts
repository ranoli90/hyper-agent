// ─── Internationalization Module ─────────────────────────────────────────
// Supported languages
export type Language = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja' | 'ko' | 'pt' | 'ru';

// Command action names in each language
const COMMAND_TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    navigate: 'navigate',
    search: 'search',
    click: 'click',
    fill: 'fill',
    extract: 'extract',
    scroll: 'scroll',
    wait: 'wait',
    goback: 'go back',
    opentab: 'open tab',
    closetab: 'close tab',
    switchtab: 'switch tab',
    hover: 'hover',
    focus: 'focus',
    back: 'back',
    go: 'go',
    visit: 'visit',
    open: 'open',
    find: 'find',
    tap: 'tap',
    select: 'select',
    enter: 'enter',
    type: 'type',
    get: 'get',
    show: 'show',
    list: 'list',
    newtab: 'new tab',
    closethistab: 'close this tab',
    switchto: 'switch to',
    change: 'change',
  },
  es: {
    navigate: 'navegar',
    search: 'buscar',
    click: 'clic',
    fill: 'rellenar',
    extract: 'extraer',
    scroll: 'desplazar',
    wait: 'esperar',
    goback: 'volver',
    opentab: 'abrir pestana',
    closetab: 'cerrar pestana',
    switchtab: 'cambiar pestana',
    hover: 'pasar',
    focus: 'enfocar',
    back: 'atras',
    go: 'ir',
    visit: 'visitar',
    open: 'abrir',
    find: 'encontrar',
    tap: 'tocar',
    select: 'seleccionar',
    enter: 'ingresar',
    type: 'escribir',
    get: 'obtener',
    show: 'mostrar',
    list: 'listar',
    newtab: 'nueva pestana',
    closethistab: 'cerrar esta pestana',
    switchto: 'cambiar a',
    change: 'cambiar',
  },
  fr: {
    navigate: 'naviguer',
    search: 'rechercher',
    click: 'cliquer',
    fill: 'remplir',
    extract: 'extraire',
    scroll: 'defiler',
    wait: 'attendre',
    goback: 'retourner',
    opentab: 'ouvrir onglet',
    closetab: 'fermer onglet',
    switchtab: 'changer onglet',
    hover: 'survoler',
    focus: 'focus',
    back: 'retour',
    go: 'aller',
    visit: 'visiter',
    open: 'ouvrir',
    find: 'trouver',
    tap: 'appuyer',
    select: 'selectionner',
    enter: 'entrer',
    type: 'taper',
    get: 'obtenir',
    show: 'afficher',
    list: 'lister',
    newtab: 'nouvel onglet',
    closethistab: 'fermer cet onglet',
    switchto: 'passer a',
    change: 'changer',
  },
  de: {
    navigate: 'navigieren',
    search: 'suchen',
    click: 'klicken',
    fill: 'ausfullen',
    extract: 'extrahieren',
    scroll: 'scrollen',
    wait: 'warten',
    goback: 'zuruck',
    opentab: 'tab offnen',
    closetab: 'tab schliessen',
    switchtab: 'tab wechseln',
    hover: 'schweben',
    focus: 'fokussieren',
    back: 'zuruck',
    go: 'gehen',
    visit: 'besuchen',
    open: 'offnen',
    find: 'finden',
    tap: 'tippen',
    select: 'auswahlen',
    enter: 'eingeben',
    type: 'eintippen',
    get: 'bekommen',
    show: 'zeigen',
    list: 'auflisten',
    newtab: 'neuer tab',
    closethistab: 'diesen tab schliessen',
    switchto: 'wechseln zu',
    change: 'andern',
  },
  zh: {
    navigate: 'dakai',
    search: 'sousuo',
    click: 'dianji',
    fill: 'tianchong',
    extract: 'tiqu',
    scroll: 'gundong',
    wait: 'dengdai',
    goback: 'fanhui',
    opentab: 'dakaixinjian',
    closetab: 'guanbixinjian',
    switchtab: 'qiehuanjiantab',
    hover: 'xuanguo',
    focus: 'jujiao',
    back: 'fanhui',
    go: 'qu',
    visit: 'fangwen',
    open: 'dakai',
    find: 'zhuaodao',
    tap: 'dianji',
    select: 'xuanze',
    enter: 'shuru',
    type: 'shuru',
    get: 'huode',
    show: 'xianshi',
    list: 'liebiao',
    newtab: 'xin jiantab',
    closethistab: 'guanbi ci jiantab',
    switchto: 'qiehuan dao',
    change: 'genggai',
  },
  ja: {
    navigate: 'navigate',
    search: 'kensaku',
    click: 'klikku',
    fill: 'nyuryoku',
    extract: 'shutoku',
    scroll: 'sukurooru',
    wait: 'taiki',
    goback: 'modoru',
    opentab: 'tab wo hiraku',
    closetab: 'tab wo tojiru',
    switchtab: 'tab wo kirikae',
    hover: 'mousa',
    focus: 'shiten wo atsumeru',
    back: 'modoru',
    go: 'iku',
    visit: 'homon',
    open: 'hiraku',
    find: 'sagasu',
    tap: 'tapu',
    select: 'sentaku',
    enter: 'nyuryoku',
    type: 'nyuryoku',
    get: 'getto',
    show: 'hyouji',
    list: 'ichiran',
    newtab: 'shin tab',
    closethistab: 'kono tab wo tojiru',
    switchto: 'kirikae',
    change: 'henkou',
  },
  ko: {
    navigate: 'navigate',
    search: 'chulha',
    click: 'klik',
    fill: 'iphaek',
    extract: 'cheswig',
    scroll: 'seureol',
    wait: 'ddae',
    goback: 'dwichi',
    opentab: 'tab yeol',
    closetab: 'tab tat',
    switchtab: 'tab gwolyeol',
    hover: 'keungda',
    focus: 'juwi',
    back: 'dwichi',
    go: 'gada',
    visit: 'bangmun',
    open: 'yeol',
    find: 'chajda',
    tap: 'teipeu',
    select: 'seontaek',
    enter: 'iphaek',
    type: 'sokhaek',
    get: 'dadeul',
    show: 'pyohyeon',
    list: 'hangyeol',
    newtab: 'saeroun tab',
    closethistab: 'i tab eu catna',
    switchto: 'gyeolhwa',
    change: 'byeon',
  },
  pt: {
    navigate: 'navegar',
    search: 'buscar',
    click: 'clicar',
    fill: 'preencher',
    extract: 'extrair',
    scroll: 'rolar',
    wait: 'esperar',
    goback: 'voltar',
    opentab: 'abrir aba',
    closetab: 'fechar aba',
    switchtab: 'trocar aba',
    hover: 'passar',
    focus: 'focar',
    back: 'voltar',
    go: 'ir',
    visit: 'visitar',
    open: 'abrir',
    find: 'achar',
    tap: 'tocar',
    select: 'selecionar',
    enter: 'digitar',
    type: 'digitar',
    get: 'obter',
    show: 'mostrar',
    list: 'listar',
    newtab: 'nova aba',
    closethistab: 'fechar esta aba',
    switchto: 'mudar para',
    change: 'alterar',
  },
  ru: {
    navigate: 'pereyti',
    search: 'poisk',
    click: 'klik',
    fill: 'zapolnit',
    extract: 'izvlech',
    scroll: 'pokrut',
    wait: 'podozhdat',
    goback: 'vernutsya',
    opentab: 'otkryt vkladku',
    closetab: 'zakryt vkladku',
    switchtab: 'pereyti na vkladku',
    hover: 'navesti',
    focus: 'fokusirovatsya',
    back: 'nazad',
    go: 'idti',
    visit: 'posetit',
    open: 'otkryt',
    find: 'naiti',
    tap: 'kliknut',
    select: 'vybrat',
    enter: 'vvesti',
    type: 'vvesti',
    get: 'poluchit',
    show: 'pokazat',
    list: 'spisok',
    newtab: 'novaya vkladka',
    closethistab: 'zakryt etu vkladku',
    switchto: 'pereyti na',
    change: 'izmenit',
  },
};

// Language detection patterns
const LANGUAGE_PATTERNS: Record<Language, RegExp[]> = {
  en: [
    /\bthe\b/i, /\band\b/i, /\bof\b/i, /\bto\b/i, /\ba\b/i, /\bin\b/i,
    /\bfor\b/i, /\bis\b/i, /\bon\b/i, /\bthat\b/i, /\bwith\b/i,
  ],
  es: [
    /\b(el|la|los|las)\b/i, /\b(de|en|del|al)\b/i, /\by\b/i, /\bque\b/i,
    /\bpor\b/i, /\bpara\b/i, /\bcon\b/i, /\bse\b/i, /\bla\b/i,
  ],
  fr: [
    /\b(le|la|les)\b/i, /\b(de|du|des|en)\b/i, /\bet\b/i, /\bque\b/i,
    /\bpour\b/i, /\bavec\b/i, /\bce\b/i, /\bpas\b/i, /\bsur\b/i,
  ],
  de: [
    /\b(der|die|das)\b/i, /\bund\b/i, /\bist\b/i, /\bvon\b/i,
    /\bmit\b/i, /\bfur\b/i, /\bnicht\b/i, /\bim\b/i, /\bauf\b/i,
  ],
  zh: [
    /[\u4e00-\u9fff]/,
  ],
  ja: [
    /[\u3040-\u309f\u30a0-\u30ff]/,
  ],
  ko: [
    /[\uac00-\ud7af\u1100-\u11ff]/,
  ],
  pt: [
    /\b(o|a|os|as)\b/i, /\bde|do|da|em\b/i, /\be\b/i, /\bque\b/i,
    /\bpara\b/i, /\bcom\b/i, /\bse\b/i, /\bpor\b/i, /\bem\b/i,
  ],
  ru: [
    /[\u0400-\u04ff]/,
  ],
};

// Action type to canonical English keyword mapping
const ACTION_KEYWORDS: Record<string, string[]> = {
  navigate: ['navigate', 'go', 'visit', 'open', 'load', 'show', 'display'],
  search: ['search', 'find', 'look', 'seek', 'query', 'google'],
  click: ['click', 'tap', 'press', 'select', 'hit'],
  fill: ['fill', 'enter', 'type', 'input', 'write', 'put'],
  extract: ['extract', 'get', 'fetch', 'grab', 'capture', 'read', 'show', 'display', 'list'],
  scroll: ['scroll', 'scroll down', 'scroll up', 'scroll to'],
  wait: ['wait', 'pause', 'delay', 'sleep'],
  goBack: ['back', 'go back', 'return', 'previous'],
  openTab: ['new tab', 'open tab', 'tab', 'create tab'],
  closeTab: ['close tab', 'close', 'close current tab'],
  switchTab: ['switch tab', 'switch to', 'change tab', 'go to tab'],
  hover: ['hover', 'mouse over', 'over'],
  focus: ['focus', 'focus on', 'activate'],
};

// Reverse mapping: translated keyword -> English action
const KEYWORD_TO_ACTION: Map<string, string> = new Map();

function buildKeywordMapping(): void {
  for (const [lang, translations] of Object.entries(COMMAND_TRANSLATIONS)) {
    for (const [action, translatedKeyword] of Object.entries(translations)) {
      // Map translated keyword to English action (need to derive from patterns)
      for (const [engAction, engKeywords] of Object.entries(ACTION_KEYWORDS)) {
        if (KEYWORD_TO_ACTION.has(translatedKeyword.toLowerCase())) continue;
        // For non-English, we use the translated keyword directly
        if (lang !== 'en') {
          KEYWORD_TO_ACTION.set(translatedKeyword.toLowerCase(), engAction);
        }
      }
    }
  }
  
  // Add English keywords
  for (const [action, keywords] of Object.entries(ACTION_KEYWORDS)) {
    for (const keyword of keywords) {
      KEYWORD_TO_ACTION.set(keyword.toLowerCase(), action);
    }
  }
}

buildKeywordMapping();

// ─── Detect Language ───────────────────────────────────────────────────
/**
 * Detect the language of input text
 */
export function detectLanguage(text: string): Language {
  const scores: Record<Language, number> = {
    en: 0, es: 0, fr: 0, de: 0, zh: 0, ja: 0, ko: 0, pt: 0, ru: 0,
  };
  
  const lowerText = text.toLowerCase();
  
  // Check each language pattern
  for (const [lang, patterns] of Object.entries(LANGUAGE_PATTERNS)) {
    const language = lang as Language;
    for (const pattern of patterns) {
      const matches = (lowerText.match(pattern) || []).length;
      scores[language] += matches;
    }
  }
  
  // Find language with highest score
  let maxScore = 0;
  let detectedLang: Language = 'en';
  
  for (const [lang, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLang = lang as Language;
    }
  }
  
  // Default to English if no strong signal
  return maxScore > 0 ? detectedLang : 'en';
}

// ─── Translate Command ─────────────────────────────────────────────────
/**
 * Translate a command from any supported language to English
 */
export function translateCommand(input: string, targetLang: Language): string {
  if (targetLang === 'en') {
    return input;
  }
  
  const translations = COMMAND_TRANSLATIONS[targetLang];
  if (!translations) {
    return input;
  }
  
  let result = input.toLowerCase();
  
  // Replace each translated keyword with English equivalent
  // Sort by length descending to avoid partial replacements
  const sortedEntries = Object.entries(translations).sort(
    (a, b) => b[1].length - a[1].length
  );
  
  for (const [action, translatedKeyword] of sortedEntries) {
    // Find English keywords for this action
    const englishKeywords = ACTION_KEYWORDS[action];
    if (!englishKeywords) continue;
    
    const primaryEnglish = englishKeywords[0];
    
    // Create regex to replace translated keyword with English
    const regex = new RegExp(`\\b${escapedRegex(translatedKeyword)}\\b`, 'gi');
    result = result.replace(regex, primaryEnglish);
  }
  
  return result;
}

// ─── Normalize Command ─────────────────────────────────────────────────
/**
 * Normalize a command by detecting language and translating to English
 */
export function normalizeCommand(input: string): { normalized: string; language: Language } {
  const detectedLang = detectLanguage(input);
  const normalized = translateCommand(input, detectedLang);
  
  return {
    normalized,
    language: detectedLang,
  };
}

// ─── Helper ────────────────────────────────────────────────────────────
function escapedRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Get Supported Languages ───────────────────────────────────────────
/**
 * Get list of all supported languages
 */
export function getSupportedLanguages(): Language[] {
  return ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'pt', 'ru'];
}

// ─── Get Language Name ─────────────────────────────────────────────────
/**
 * Get display name for a language code
 */
export function getLanguageName(lang: Language): string {
  const names: Record<Language, string> = {
    en: 'English',
    es: 'Espanol',
    fr: 'Francais',
    de: 'Deutsch',
    zh: '中文',
    ja: '日本語',
    ko: '한국어',
    pt: 'Portugues',
    ru: 'Русский',
  };
  return names[lang];
}
