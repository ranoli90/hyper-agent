import type { Language } from './types';

export interface TranslationDictionary {
  [key: string]: string;
}

export interface I18nConfig {
  defaultLanguage: Language;
  fallbackLanguage: Language;
  storageKey: string;
}

const STORAGE_KEY = 'hyperagent_language';

const translations: Record<Language, TranslationDictionary> = {
  en: {
    'app.name': 'HyperAgent',
    'app.tagline': 'AI Browser Agent',
    'status.running': 'Agent is running...',
    'status.idle': 'Ready',
    'status.error': 'Error occurred',
    'status.stopped': 'Stopped',
    'status.analyzing': 'Analyzing page...',
    'status.planning': 'Planning...',
    'status.executing': 'Executing...',
    'status.verifying': 'Verifying...',
    'status.thinking': 'Thinking...',
    'status.done': 'Done',
    'action.click': 'Click',
    'action.fill': 'Fill',
    'action.select': 'Select',
    'action.scroll': 'Scroll',
    'action.navigate': 'Navigate',
    'action.goBack': 'Go Back',
    'action.wait': 'Wait',
    'action.pressKey': 'Press Key',
    'action.hover': 'Hover',
    'action.focus': 'Focus',
    'action.extract': 'Extract',
    'action.openTab': 'Open Tab',
    'action.closeTab': 'Close Tab',
    'action.switchTab': 'Switch Tab',
    'action.getTabs': 'Get Tabs',
    'error.no_api_key': 'API key not set. Open settings (gear icon) and add your API key.',
    'error.rate_limited': 'Rate limit exceeded. Please wait.',
    'error.element_not_found': 'Element not found on page',
    'error.element_not_visible': 'Element exists but is not visible',
    'error.element_disabled': 'Element is disabled',
    'error.action_failed': 'Action failed',
    'error.timeout': 'Operation timed out',
    'error.navigation': 'Navigation failed',
    'error.blacklisted': 'Site is blacklisted',
    'error.agent_running': 'Agent is already running',
    'error.max_steps': 'Maximum steps reached',
    'error.llm_failed': 'LLM call failed',
    'confirm.destructive': 'This action may be destructive. Proceed?',
    'confirm.approve': 'Approve',
    'confirm.reject': 'Reject',
    'settings.title': 'Settings',
    'settings.api_key': 'API Key',
    'settings.model': 'Model',
    'settings.max_steps': 'Max Steps',
    'settings.vision': 'Enable Vision',
    'settings.auto_retry': 'Auto Retry',
    'settings.confirm_destructive': 'Confirm Destructive Actions',
    'settings.dry_run': 'Dry Run Mode',
    'settings.blacklist': 'Site Blacklist',
    'settings.save': 'Save Settings',
    'settings.saved': 'Settings saved successfully',
    'sidepanel.placeholder': 'Type a command...',
    'sidepanel.send': 'Send',
    'sidepanel.stop': 'Stop',
    'sidepanel.clear': 'Clear History',
    'tab.chat': 'Chat',
    'tab.tools': 'Tools',
    'tab.swarm': 'Swarm',
    'tab.settings': 'Settings',
    'memory.domains': 'Domains Tracked',
    'memory.actions': 'Total Actions',
    'memory.strategies': 'Learned Strategies',
  },
  es: {
    'app.name': 'HyperAgent',
    'app.tagline': 'Agente de Navegador IA',
    'status.running': 'El agente está ejecutando...',
    'status.idle': 'Listo',
    'status.error': 'Ocurrió un error',
    'status.stopped': 'Detenido',
    'status.analyzing': 'Analizando página...',
    'status.planning': 'Planificando...',
    'status.executing': 'Ejecutando...',
    'status.verifying': 'Verificando...',
    'status.thinking': 'Pensando...',
    'status.done': 'Hecho',
    'error.no_api_key': 'Clave API no configurada. Abre la configuración y agrega tu clave API.',
    'error.rate_limited': 'Límite de tasa excedido. Por favor espera.',
    'error.element_not_found': 'Elemento no encontrado en la página',
    'error.agent_running': 'El agente ya está ejecutando',
    'confirm.destructive': 'Esta acción puede ser destructiva. ¿Continuar?',
    'confirm.approve': 'Aprobar',
    'confirm.reject': 'Rechazar',
    'settings.title': 'Configuración',
    'settings.save': 'Guardar',
    'settings.saved': 'Configuración guardada exitosamente',
    'sidepanel.placeholder': 'Escribe un comando...',
    'sidepanel.send': 'Enviar',
    'sidepanel.stop': 'Detener',
  },
  fr: {
    'app.name': 'HyperAgent',
    'app.tagline': 'Agent de Navigateur IA',
    'status.running': "L'agent est en cours d'exécution...",
    'status.idle': 'Prêt',
    'status.error': 'Une erreur est survenue',
    'status.stopped': 'Arrêté',
    'status.analyzing': 'Analyse de la page...',
    'status.planning': 'Planification...',
    'status.executing': 'Exécution...',
    'status.done': 'Terminé',
    'error.no_api_key': "Clé API non définie. Ouvrez les paramètres et ajoutez votre clé API.",
    'confirm.destructive': 'Cette action peut être destructive. Continuer?',
    'confirm.approve': 'Approuver',
    'confirm.reject': 'Rejeter',
    'settings.title': 'Paramètres',
    'settings.save': 'Sauvegarder',
    'sidepanel.placeholder': 'Tapez une commande...',
    'sidepanel.send': 'Envoyer',
    'sidepanel.stop': 'Arrêter',
  },
  de: {
    'app.name': 'HyperAgent',
    'app.tagline': 'KI-Browser-Agent',
    'status.running': 'Agent wird ausgeführt...',
    'status.idle': 'Bereit',
    'status.error': 'Fehler aufgetreten',
    'status.stopped': 'Gestoppt',
    'status.done': 'Fertig',
    'error.no_api_key': 'API-Schlüssel nicht gesetzt. Öffne die Einstellungen und füge deinen API-Schlüssel hinzu.',
    'confirm.destructive': 'Diese Aktion kann destruktiv sein. Fortfahren?',
    'confirm.approve': 'Genehmigen',
    'confirm.reject': 'Ablehnen',
    'settings.title': 'Einstellungen',
    'settings.save': 'Speichern',
    'sidepanel.placeholder': 'Befehl eingeben...',
    'sidepanel.send': 'Senden',
    'sidepanel.stop': 'Stoppen',
  },
  zh: {
    'app.name': 'HyperAgent',
    'app.tagline': 'AI 浏览器代理',
    'status.running': '代理正在运行...',
    'status.idle': '就绪',
    'status.error': '发生错误',
    'status.stopped': '已停止',
    'status.done': '完成',
    'error.no_api_key': 'API 密钥未设置。请打开设置并添加您的 API 密钥。',
    'confirm.destructive': '此操作可能是破坏性的。是否继续？',
    'confirm.approve': '批准',
    'confirm.reject': '拒绝',
    'settings.title': '设置',
    'settings.save': '保存',
    'sidepanel.placeholder': '输入命令...',
    'sidepanel.send': '发送',
    'sidepanel.stop': '停止',
  },
  ja: {
    'app.name': 'HyperAgent',
    'app.tagline': 'AIブラウザエージェント',
    'status.running': 'エージェント実行中...',
    'status.idle': '準備完了',
    'status.error': 'エラーが発生しました',
    'status.stopped': '停止済み',
    'status.done': '完了',
    'error.no_api_key': 'APIキーが設定されていません。設定を開いてAPIキーを追加してください。',
    'confirm.destructive': 'この操作は破壊的です。続行しますか？',
    'confirm.approve': '承認',
    'confirm.reject': '拒否',
    'settings.title': '設定',
    'settings.save': '保存',
    'sidepanel.placeholder': 'コマンドを入力...',
    'sidepanel.send': '送信',
    'sidepanel.stop': '停止',
  },
  ko: {
    'app.name': 'HyperAgent',
    'app.tagline': 'AI 브라우저 에이전트',
    'status.running': '에이전트 실행 중...',
    'status.idle': '준비',
    'status.error': '오류 발생',
    'status.stopped': '중지됨',
    'status.done': '완료',
    'error.no_api_key': 'API 키가 설정되지 않았습니다. 설정을 열고 API 키를 추가하세요.',
    'confirm.approve': '승인',
    'confirm.reject': '거부',
    'settings.title': '설정',
    'settings.save': '저장',
    'sidepanel.placeholder': '명령어 입력...',
    'sidepanel.send': '전송',
    'sidepanel.stop': '중지',
  },
  pt: {
    'app.name': 'HyperAgent',
    'app.tagline': 'Agente de Navegador IA',
    'status.running': 'Agente em execução...',
    'status.idle': 'Pronto',
    'status.error': 'Erro ocorrido',
    'status.stopped': 'Parado',
    'status.done': 'Concluído',
    'error.no_api_key': 'Chave API não definida. Abra as configurações e adicione sua chave API.',
    'confirm.approve': 'Aprovar',
    'confirm.reject': 'Rejeitar',
    'settings.title': 'Configurações',
    'settings.save': 'Salvar',
    'sidepanel.placeholder': 'Digite um comando...',
    'sidepanel.send': 'Enviar',
    'sidepanel.stop': 'Parar',
  },
  ru: {
    'app.name': 'HyperAgent',
    'app.tagline': 'ИИ-агент браузера',
    'status.running': 'Агент выполняется...',
    'status.idle': 'Готов',
    'status.error': 'Произошла ошибка',
    'status.stopped': 'Остановлен',
    'status.done': 'Готово',
    'error.no_api_key': 'API-ключ не установлен. Откройте настройки и добавьте ваш API-ключ.',
    'confirm.approve': 'Одобрить',
    'confirm.reject': 'Отклонить',
    'settings.title': 'Настройки',
    'settings.save': 'Сохранить',
    'sidepanel.placeholder': 'Введите команду...',
    'sidepanel.send': 'Отправить',
    'sidepanel.stop': 'Остановить',
  },
};

class I18nManager {
  private currentLanguage: Language = 'en';
  private fallbackLanguage: Language = 'en';
  private customTranslations: Record<string, TranslationDictionary> = {};
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      if (chrome?.storage?.local) {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        if (data[STORAGE_KEY] && this.isValidLanguage(data[STORAGE_KEY])) {
          this.currentLanguage = data[STORAGE_KEY] as Language;
        }
      }
    } catch {
      // Use default language
    }
    this.initialized = true;
  }

  private isValidLanguage(lang: string): lang is Language {
    return ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'pt', 'ru'].includes(lang);
  }

  t(key: string, params?: Record<string, string | number>): string {
    const dict = this.customTranslations[this.currentLanguage] ||
      translations[this.currentLanguage] || {};
    const fallbackDict = translations[this.fallbackLanguage] || {};

    let text = dict[key] || fallbackDict[key] || key;

    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      }
    }

    return text;
  }

  async setLanguage(language: Language): Promise<void> {
    if (!this.isValidLanguage(language)) return;
    this.currentLanguage = language;
    try {
      if (chrome?.storage?.local) {
        await chrome.storage.local.set({ [STORAGE_KEY]: language });
      }
    } catch {
      // Storage not available
    }
  }

  getLanguage(): Language {
    return this.currentLanguage;
  }

  getSupportedLanguages(): { code: Language; name: string }[] {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Español' },
      { code: 'fr', name: 'Français' },
      { code: 'de', name: 'Deutsch' },
      { code: 'zh', name: '中文' },
      { code: 'ja', name: '日本語' },
      { code: 'ko', name: '한국어' },
      { code: 'pt', name: 'Português' },
      { code: 'ru', name: 'Русский' },
    ];
  }

  addTranslations(language: Language, dict: TranslationDictionary): void {
    if (!this.customTranslations[language]) {
      this.customTranslations[language] = {};
    }
    Object.assign(this.customTranslations[language], dict);
  }

  detectBrowserLanguage(): Language {
    try {
      const browserLang = navigator.language.split('-')[0];
      if (this.isValidLanguage(browserLang)) {
        return browserLang;
      }
    } catch {
      // navigator not available
    }
    return 'en';
  }

  getTranslationKeys(): string[] {
    return Object.keys(translations.en);
  }

  hasTranslation(key: string, language?: Language): boolean {
    const lang = language || this.currentLanguage;
    const dict = translations[lang] || {};
    return key in dict;
  }
}

export const i18n = new I18nManager();
export const t = (key: string, params?: Record<string, string | number>) => i18n.t(key, params);
