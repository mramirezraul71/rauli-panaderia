import { useEffect, useState } from "react";
import { db } from "../services/dataService";
import { setBusinessConfig } from "../config/businessConfig";
import { LANGUAGES, getLanguageConfig, resolveLanguage } from "../config/languages";

const TERMS_CONTENT = {
  es: {
    title: "Acuerdo de uso y protección de datos",
    p1: "Para usar GENESIS, debes aceptar este acuerdo. El sistema almacena datos del negocio y los protege mediante cifrado local. El acceso está controlado por roles y se limita a las funciones necesarias para cada trabajador.",
    p2: "Al aceptar, confirmas que cuentas con autorización para registrar datos de clientes, ventas e inventario, y aceptas el uso de cifrado local para proteger la información.",
    footer: "Versión del acuerdo: v1.0 • Última actualización: 2026-01-26",
    checkbox: "He leído y acepto el acuerdo de uso.",
    action: "Aceptar y continuar",
    languageLabel: "Idioma del acuerdo"
  },
  en: {
    title: "Usage and Data Protection Agreement",
    p1: "To use GENESIS, you must accept this agreement. The system stores business data and protects it with local encryption. Access is role‑based and limited to necessary functions.",
    p2: "By accepting, you confirm you are authorized to record customer, sales, and inventory data, and you agree to the use of local encryption to protect information.",
    footer: "Agreement version: v1.0 • Last updated: 2026-01-26",
    checkbox: "I have read and accept the agreement.",
    action: "Accept and continue",
    languageLabel: "Agreement language"
  },
  pt: {
    title: "Acordo de uso e proteção de dados",
    p1: "Para usar o GENESIS, você deve aceitar este acordo. O sistema armazena dados do negócio e os protege com criptografia local. O acesso é controlado por funções e limitado ao necessário.",
    p2: "Ao aceitar, você confirma que tem autorização para registrar dados de clientes, vendas e estoque, e concorda com o uso de criptografia local para proteger as informações.",
    footer: "Versão do acordo: v1.0 • Última atualização: 2026-01-26",
    checkbox: "Li e aceito o acordo de uso.",
    action: "Aceitar e continuar",
    languageLabel: "Idioma do acordo"
  },
  fr: {
    title: "Accord d'utilisation et protection des données",
    p1: "Pour utiliser GENESIS, vous devez accepter cet accord. Le système stocke les données de l'entreprise et les protège par chiffrement local. L'accès est contrôlé par rôles et limité aux fonctions nécessaires.",
    p2: "En acceptant, vous confirmez être autorisé à enregistrer des données clients, ventes et stock, et acceptez l'utilisation du chiffrement local pour protéger les informations.",
    footer: "Version de l'accord : v1.0 • Dernière mise à jour : 2026-01-26",
    checkbox: "J'ai lu et j'accepte l'accord d'utilisation.",
    action: "Accepter et continuer",
    languageLabel: "Langue de l'accord"
  },
  de: {
    title: "Nutzungs- und Datenschutzvereinbarung",
    p1: "Um GENESIS zu verwenden, müssen Sie dieser Vereinbarung zustimmen. Das System speichert Geschäftsdaten und schützt sie durch lokale Verschlüsselung. Der Zugriff ist rollenbasiert und auf notwendige Funktionen beschränkt.",
    p2: "Mit der Zustimmung bestätigen Sie, dass Sie zur Erfassung von Kunden-, Verkaufs- und Bestandsdaten berechtigt sind und der lokalen Verschlüsselung zustimmen.",
    footer: "Version der Vereinbarung: v1.0 • Letzte Aktualisierung: 2026-01-26",
    checkbox: "Ich habe die Vereinbarung gelesen und akzeptiere sie.",
    action: "Akzeptieren und fortfahren",
    languageLabel: "Sprache der Vereinbarung"
  },
  it: {
    title: "Accordo di utilizzo e protezione dei dati",
    p1: "Per usare GENESIS, devi accettare questo accordo. Il sistema memorizza i dati aziendali e li protegge con crittografia locale. L'accesso è controllato dai ruoli ed è limitato alle funzioni necessarie.",
    p2: "Accettando, confermi di essere autorizzato a registrare dati di clienti, vendite e inventario e accetti l'uso della crittografia locale per proteggere le informazioni.",
    footer: "Versione dell'accordo: v1.0 • Ultimo aggiornamento: 2026-01-26",
    checkbox: "Ho letto e accetto l'accordo di utilizzo.",
    action: "Accetta e continua",
    languageLabel: "Lingua dell'accordo"
  },
  ru: {
    title: "Соглашение об использовании и защите данных",
    p1: "Для использования GENESIS необходимо принять это соглашение. Система хранит данные бизнеса и защищает их локальным шифрованием. Доступ ограничен ролями и только необходимыми функциями.",
    p2: "Принимая соглашение, вы подтверждаете право на внесение данных клиентов, продаж и склада и соглашаетесь с использованием локального шифрования.",
    footer: "Версия соглашения: v1.0 • Последнее обновление: 2026-01-26",
    checkbox: "Я прочитал(а) и принимаю соглашение.",
    action: "Принять и продолжить",
    languageLabel: "Язык соглашения"
  },
  ar: {
    title: "اتفاقية الاستخدام وحماية البيانات",
    p1: "لاستخدام GENESIS يجب قبول هذه الاتفاقية. يقوم النظام بتخزين بيانات العمل وحمايتها بالتشفير المحلي. الوصول قائم على الأدوار ومحدود بالوظائف اللازمة فقط.",
    p2: "بالموافقة، تؤكد أنك مخول لتسجيل بيانات العملاء والمبيعات والمخزون، وتوافق على استخدام التشفير المحلي لحماية المعلومات.",
    footer: "إصدار الاتفاقية: v1.0 • آخر تحديث: 2026-01-26",
    checkbox: "قرأتُ وأوافق على اتفاقية الاستخدام.",
    action: "موافقة ومتابعة",
    languageLabel: "لغة الاتفاقية"
  },
  zh: {
    title: "使用与数据保护协议",
    p1: "使用 GENESIS 需接受本协议。系统存储业务数据，并通过本地加密保护。访问按角色控制，仅限必要功能。",
    p2: "接受即表示您有权录入客户、销售和库存数据，并同意使用本地加密保护信息。",
    footer: "协议版本：v1.0 • 最后更新：2026-01-26",
    checkbox: "我已阅读并同意该协议。",
    action: "同意并继续",
    languageLabel: "协议语言"
  },
  ja: {
    title: "利用規約とデータ保護に関する同意",
    p1: "GENESIS を利用するには本規約に同意する必要があります。システムは事業データを保存し、ローカル暗号化で保護します。アクセスは役割に基づき必要な機能に限定されます。",
    p2: "同意することで、顧客・販売・在庫データの登録権限があること、およびローカル暗号化の使用に同意することを確認します。",
    footer: "規約バージョン: v1.0 • 最終更新: 2026-01-26",
    checkbox: "内容を読み、同意します。",
    action: "同意して続行",
    languageLabel: "規約の言語"
  },
  ko: {
    title: "이용 및 데이터 보호 동의서",
    p1: "GENESIS를 사용하려면 이 동의서를 수락해야 합니다. 시스템은 사업 데이터를 저장하고 로컬 암호화로 보호합니다. 접근은 역할 기반이며 필요한 기능으로 제한됩니다.",
    p2: "동의함으로써 고객, 판매, 재고 데이터를 등록할 권한이 있음을 확인하고 로컬 암호화 사용에 동의합니다.",
    footer: "동의서 버전: v1.0 • 최종 업데이트: 2026-01-26",
    checkbox: "내용을 읽고 동의합니다.",
    action: "동의하고 계속",
    languageLabel: "동의서 언어"
  },
  hi: {
    title: "उपयोग और डेटा संरक्षण समझौता",
    p1: "GENESIS का उपयोग करने के लिए यह समझौता स्वीकार करना आवश्यक है। सिस्टम व्यापार डेटा संग्रहीत करता है और स्थानीय एन्क्रिप्शन से सुरक्षित करता है। पहुंच भूमिकाओं के आधार पर सीमित रहती है।",
    p2: "स्वीकार करके आप पुष्टि करते हैं कि आपको ग्राहक, बिक्री और इन्वेंटरी डेटा दर्ज करने की अनुमति है और आप स्थानीय एन्क्रिप्शन के उपयोग से सहमत हैं।",
    footer: "समझौता संस्करण: v1.0 • अंतिम अपडेट: 2026-01-26",
    checkbox: "मैंने पढ़ा और स्वीकार किया है।",
    action: "स्वीकार करें और आगे बढ़ें",
    languageLabel: "समझौते की भाषा"
  }
};

export default function TermsGate({ onAccept }) {
  const [accepted, setAccepted] = useState(false);
  const [language, setLanguage] = useState("es");

  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const stored = await db.settings?.get("app_language");
        if (stored?.value && TERMS_CONTENT[stored.value]) {
          setLanguage(stored.value);
          return;
        }
      } catch {}
      const guess = resolveLanguage(navigator.language);
      setLanguage(TERMS_CONTENT[guess] ? guess : "es");
    };
    loadLanguage();
  }, []);

  const content = TERMS_CONTENT[language] || TERMS_CONTENT.es;

  return (
    <div className="fixed inset-0 bg-slate-950/95 text-white z-[70] flex items-center justify-center p-6">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-semibold">{content.title}</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">{content.languageLabel}</label>
            <select
              value={language}
              onChange={async (e) => {
                const next = e.target.value;
                setLanguage(next);
                const langConfig = getLanguageConfig(next);
                try {
                  await db.settings?.put({ key: "app_language", value: next });
                  await db.settings?.put({ key: "terms_language", value: next });
                  if (langConfig?.locale) {
                    await db.settings?.put({ key: "date_locale", value: langConfig.locale });
                    setBusinessConfig({ appLanguage: next, dateLocale: langConfig.locale });
                  } else {
                    setBusinessConfig({ appLanguage: next });
                  }
                } catch {}
              }}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>{lang.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="text-sm text-slate-300 space-y-3 max-h-[50vh] overflow-y-auto pr-2">
          <p>{content.p1}</p>
          <p>{content.p2}</p>
          <p className="text-slate-400">{content.footer}</p>
        </div>
        <label className="flex items-center gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="accent-violet-600"
          />
          {content.checkbox}
        </label>
        <button
          disabled={!accepted}
          onClick={onAccept}
          className="w-full py-3 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold rounded-xl"
        >
          {content.action}
        </button>
      </div>
    </div>
  );
}
