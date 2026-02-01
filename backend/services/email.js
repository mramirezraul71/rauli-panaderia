import nodemailer from 'nodemailer';

const getTransport = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  if (!host) return null;

  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined
  });
};

const normalizeLanguage = (value = '') => {
  const lang = String(value).toLowerCase();
  if (lang.startsWith('pt')) return 'pt';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('fr')) return 'fr';
  if (lang.startsWith('de')) return 'de';
  if (lang.startsWith('it')) return 'it';
  if (lang.startsWith('ru')) return 'ru';
  if (lang.startsWith('ar')) return 'ar';
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('ja')) return 'ja';
  if (lang.startsWith('ko')) return 'ko';
  if (lang.startsWith('hi')) return 'hi';
  return 'es';
};

const TEMPLATES = {
  es: {
    subject: 'Invitación a {{business}}',
    hello: 'Hola,',
    intro: 'Te invitamos a usar GENESIS. Descarga e ingresa con tu código:',
    access: 'Acceso',
    contact: 'Contacto'
  },
  en: {
    subject: 'Invitation to {{business}}',
    hello: 'Hello,',
    intro: 'You are invited to use GENESIS. Download and sign in with your code:',
    access: 'Access',
    contact: 'Contact'
  },
  pt: {
    subject: 'Convite para {{business}}',
    hello: 'Olá,',
    intro: 'Você foi convidado para usar o GENESIS. Baixe e entre com seu código:',
    access: 'Acesso',
    contact: 'Contato'
  },
  fr: {
    subject: 'Invitation à {{business}}',
    hello: 'Bonjour,',
    intro: 'Vous êtes invité à utiliser GENESIS. Téléchargez et connectez‑vous avec votre code :',
    access: 'Accès',
    contact: 'Contact'
  },
  de: {
    subject: 'Einladung zu {{business}}',
    hello: 'Hallo,',
    intro: 'Sie sind eingeladen, GENESIS zu nutzen. Laden Sie es herunter und melden Sie sich mit Ihrem Code an:',
    access: 'Zugang',
    contact: 'Kontakt'
  },
  it: {
    subject: 'Invito a {{business}}',
    hello: 'Ciao,',
    intro: 'Sei invitato a usare GENESIS. Scarica e accedi con il tuo codice:',
    access: 'Accesso',
    contact: 'Contatto'
  },
  ru: {
    subject: 'Приглашение в {{business}}',
    hello: 'Здравствуйте,',
    intro: 'Вас пригласили в GENESIS. Скачайте и войдите по коду:',
    access: 'Доступ',
    contact: 'Контакт'
  },
  ar: {
    subject: 'دعوة إلى {{business}}',
    hello: 'مرحبًا،',
    intro: 'تمت دعوتك لاستخدام GENESIS. قم بالتنزيل وسجّل الدخول باستخدام الرمز:',
    access: 'الدخول',
    contact: 'جهة الاتصال'
  },
  zh: {
    subject: '邀请加入 {{business}}',
    hello: '你好，',
    intro: '邀请你使用 GENESIS。请下载并使用代码登录：',
    access: '入口',
    contact: '联系人'
  },
  ja: {
    subject: '{{business}} への招待',
    hello: 'こんにちは、',
    intro: 'GENESIS への招待です。ダウンロードしてコードでログインしてください：',
    access: 'アクセス',
    contact: '連絡先'
  },
  ko: {
    subject: '{{business}} 초대',
    hello: '안녕하세요,',
    intro: 'GENESIS 사용 초대입니다. 다운로드 후 코드로 로그인하세요:',
    access: '접속',
    contact: '연락처'
  },
  hi: {
    subject: '{{business}} के लिए निमंत्रण',
    hello: 'नमस्ते,',
    intro: 'आपको GENESIS के उपयोग के लिए आमंत्रित किया गया है। डाउनलोड करें और कोड से लॉगिन करें:',
    access: 'एक्सेस',
    contact: 'संपर्क'
  }
};

const getTemplate = (language, businessName) => {
  const lang = normalizeLanguage(language);
  const tpl = TEMPLATES[lang] || TEMPLATES.es;
  const safeBusiness = businessName || 'GENESIS';
  return {
    ...tpl,
    subject: tpl.subject.replace('{{business}}', safeBusiness)
  };
};

const formatInviteLine = (invite) => {
  const name = invite.name || 'Colaborador';
  const role = invite.role || 'cajero';
  return `• ${name} (${role}) → Código: ${invite.code}`;
};

export const sendInvitationEmails = async ({ ownerEmail, invites, appUrl, businessName, language }) => {
  const transport = getTransport();
  if (!transport) {
    throw new Error('SMTP no configurado');
  }

  const from = process.env.SMTP_FROM || ownerEmail || process.env.SMTP_USER;
  if (!from) {
    throw new Error('No hay remitente configurado');
  }

  const safeAppUrl = appUrl || process.env.APP_URL || 'http://localhost:3000';
  const template = getTemplate(language, businessName);
  const inviteLines = invites.map(formatInviteLine);

  const bodyText = [
    template.hello,
    '',
    template.intro,
    ...inviteLines,
    '',
    `${template.access}: ${safeAppUrl}`,
    '',
    `${template.contact}: ${ownerEmail}`
  ].join('\n');

  const bodyHtml = `
    <p>${template.hello}</p>
    <p>${template.intro}</p>
    <ul>${inviteLines.map((line) => `<li>${line}</li>`).join('')}</ul>
    <p><strong>${template.access}:</strong> <a href="${safeAppUrl}">${safeAppUrl}</a></p>
    <p><strong>${template.contact}:</strong> ${ownerEmail}</p>
  `;

  const results = await Promise.allSettled(
    invites.map((invite) => transport.sendMail({
      from,
      to: invite.email,
      subject: template.subject,
      text: bodyText,
      html: bodyHtml
    }))
  );

  const sent = [];
  const failed = [];
  results.forEach((result, index) => {
    const invite = invites[index];
    if (result.status === 'fulfilled') {
      sent.push(invite.email);
    } else {
      failed.push({ email: invite.email, error: result.reason?.message || 'Error al enviar' });
    }
  });

  return { sent, failed };
};

export const testSmtpConnection = async () => {
  const transport = getTransport();
  if (!transport) {
    throw new Error('SMTP no configurado');
  }
  await transport.verify();
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true'
  };
};
