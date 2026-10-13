// fold-chat-junk-lexicon.js — DECLARED vocabulary of page chrome and walls, per language. Data only.
//
// A phrase here is something a page says ABOUT ITSELF or ITS SITE (a menu, a banner, a consent notice, a login prompt,
// a footer line, a bot-wall, an expiry notice, a paywall) — never about the subject the page is for. Matching is on the
// case- and diacritic-folded text (fold-chat-mind.js `fold`), never on capitals, so no capital-letter logic lives here.
//
// DECLARED, NOT MEASURED (Constitution II.11 — each with its giver): written by the author of fold-chat-junk.js from
// the chrome that recurs across public sites (cookie notices, "skip to content", sign-in prompts, "all rights reserved",
// bot-check and expiry notices), then tuned ONLY against the dev third of docs/SNIP-JUNK-PREREG.md's hand labels (eval/swarm/
// junk-labels.json). The held-out third was not used. LATER ADDITIONS, disclosed: the waiting-room wall phrases and the
// affiliate / newsletter / endorsement / baseline-badge / update-note phrases were added AFTER the first hand audit of the new
// ladder's output (docs/SNIP-JUNK-PREREG.md section 6), so the second audit is in-sample for them. A language with no entry simply matches nothing here and is judged
// by the structural signals alone (a long run with no sentence stop and almost no function words).
//
// `CHROME`  phrases that make a short unit chrome, or a long unit chrome when they cover enough of it.
// `WALL`    phrases that, in a SHORT page text, say the page asked for is not being shown (a block, a gate, an expiry).
// Both are plain arrays of strings. Add a language by adding a key; never by adding code.

export const CHROME = Object.freeze({
  en: [
    "skip to main content", "skip to content", "skip to navigation", "skip to footer", "jump to content", "jump to navigation", "jump to search",
    "main menu", "move to sidebar", "toggle navigation", "open menu", "close menu",
    "sign in", "sign up", "log in", "log out", "register now", "create an account", "create account", "my account", "your account",
    "newsletter", "sign up for our",
    "this website uses cookies", "this site uses cookies", "we use cookies", "cookie settings", "cookie policy", "cookie preferences", "cookie consent",
    "accept all cookies", "accept all", "reject all", "manage preferences", "manage cookies", "consent details", "necessary cookies", "preference cookies", "statistics cookies", "marketing cookies",
    "privacy policy", "privacy notice", "terms of use", "terms of service", "terms and conditions", "legal notice", "do not sell or share", "do not sell my",
    "all rights reserved", "back to top", "site map", "sitemap",
    "print this page", "email this page",
    "reload to refresh your session", "you switched accounts on another tab", "you signed in with another tab", "dismiss alert", "repository files navigation",
    "gov website belongs to an official government organization", "official websites use", "secure .gov websites use", "here's how you know", "an official website of",
    "give feedback",
    "log in to",
    "mychart", "find a provider", "donate now",
    "affiliate commission", "affiliate links", "may earn a commission", "this post may contain", "thanks for supporting the site", "thank you for your interest", "sign up to get", "sign up for", "receive regular emails", "other subscribers", "unsubscribe", "we do not endorse", "advertising on our site", "helps support our mission", "this feature is well established", "baseline widely available", "calendar notifications", "notify me", "are updated with the completion", "updated daily", "last updated", "learn about vigilant mode", "if an article link referred you here", "it lists works that share the same title", "this disambiguation page", "[#iabv2settings#]", "make valid reports on the unique number of visitors", "distribution of traffic", "remember information that changes the way the website behaves", "cookies are small text files", "strictly necessary", "verified signature", "gpg key",
  ],
  es: ["saltar al contenido", "ir al contenido", "menú principal", "iniciar sesión", "cerrar sesión", "registrarse", "suscríbete", "suscribirse", "boletín", "política de privacidad", "términos de uso", "términos y condiciones", "aviso legal", "política de cookies", "usamos cookies", "este sitio utiliza cookies", "aceptar todas", "rechazar todas", "todos los derechos reservados", "derechos de autor", "contáctenos", "contacto", "sobre nosotros", "síguenos", "compartir", "leer más", "ver más", "buscar", "volver arriba", "publicidad", "mapa del sitio", "más información"],
  fr: ["aller au contenu", "passer au contenu", "menu principal", "se connecter", "connexion", "se déconnecter", "s'inscrire", "inscription", "s'abonner", "abonnez-vous", "infolettre", "politique de confidentialité", "conditions d'utilisation", "mentions légales", "politique de cookies", "nous utilisons des cookies", "ce site utilise des cookies", "tout accepter", "tout refuser", "tous droits réservés", "nous contacter", "à propos", "suivez-nous", "partager", "lire la suite", "voir plus", "rechercher", "haut de page", "publicité", "plan du site", "en savoir plus"],
  de: ["zum inhalt springen", "zum hauptinhalt", "hauptmenü", "anmelden", "abmelden", "registrieren", "newsletter abonnieren", "datenschutz", "datenschutzerklärung", "nutzungsbedingungen", "allgemeine geschäftsbedingungen", "impressum", "cookie-richtlinie", "wir verwenden cookies", "diese website verwendet cookies", "alle akzeptieren", "alle ablehnen", "alle rechte vorbehalten", "kontakt", "über uns", "folgen sie uns", "teilen", "weiterlesen", "mehr anzeigen", "suche", "nach oben", "werbung", "sitemap", "mehr erfahren"],
  pt: ["ir para o conteúdo", "saltar para o conteúdo", "menu principal", "entrar", "sair", "cadastre-se", "inscreva-se", "assinar", "newsletter", "política de privacidade", "termos de uso", "termos e condições", "política de cookies", "usamos cookies", "este site usa cookies", "aceitar todos", "todos os direitos reservados", "fale conosco", "contato", "sobre nós", "siga-nos", "compartilhar", "leia mais", "ver mais", "buscar", "voltar ao topo", "publicidade", "mapa do site", "saiba mais"],
  it: ["vai al contenuto", "salta al contenuto", "menu principale", "accedi", "esci", "registrati", "iscriviti", "newsletter", "informativa sulla privacy", "termini di utilizzo", "termini e condizioni", "cookie policy", "utilizziamo i cookie", "questo sito utilizza i cookie", "accetta tutti", "rifiuta tutti", "tutti i diritti riservati", "contattaci", "chi siamo", "seguici", "condividi", "leggi di più", "mostra altro", "cerca", "torna su", "pubblicità", "mappa del sito", "scopri di più"],
  nl: ["ga naar de inhoud", "hoofdmenu", "inloggen", "uitloggen", "registreren", "nieuwsbrief", "privacybeleid", "gebruiksvoorwaarden", "cookiebeleid", "wij gebruiken cookies", "alles accepteren", "alle rechten voorbehouden", "contact", "over ons", "volg ons", "delen", "lees meer", "zoeken", "terug naar boven", "advertentie"],
  ru: ["перейти к содержимому", "перейти к основному содержанию", "главное меню", "войти", "выйти", "регистрация", "подписаться", "рассылка", "политика конфиденциальности", "условия использования", "пользовательское соглашение", "файлы cookie", "мы используем cookie", "принять все", "все права защищены", "контакты", "о нас", "поделиться", "читать далее", "подробнее", "поиск", "наверх", "реклама", "карта сайта"],
  zh: ["跳至内容", "跳到内容", "主菜单", "主選單", "登录", "登入", "登出", "注册", "註冊", "订阅", "訂閱", "隐私政策", "隱私權政策", "使用条款", "使用條款", "服务条款", "版权所有", "版權所有", "保留所有权利", "我们使用cookie", "接受所有", "联系我们", "聯絡我們", "关于我们", "關於我們", "分享", "阅读更多", "閱讀更多", "查看更多", "搜索", "搜尋", "返回顶部", "广告", "廣告", "网站地图", "了解更多"],
  ja: ["メインコンテンツへスキップ", "本文へ移動", "メインメニュー", "ログイン", "ログアウト", "新規登録", "会員登録", "購読", "メルマガ", "プライバシーポリシー", "利用規約", "個人情報", "クッキー", "cookieを使用", "すべて許可", "すべて拒否", "無断転載", "著作権", "お問い合わせ", "会社概要", "フォロー", "シェア", "もっと見る", "続きを読む", "検索", "ページトップ", "広告", "サイトマップ", "詳しく見る"],
  ko: ["본문 바로가기", "주 메뉴", "로그인", "로그아웃", "회원가입", "구독", "뉴스레터", "개인정보처리방침", "이용약관", "쿠키", "모두 수락", "모든 권리 보유", "저작권", "문의하기", "회사 소개", "공유", "더 보기", "검색", "맨 위로", "광고", "사이트맵"],
  ar: ["انتقل إلى المحتوى", "القائمة الرئيسية", "تسجيل الدخول", "تسجيل الخروج", "إنشاء حساب", "اشترك", "النشرة الإخبارية", "سياسة الخصوصية", "شروط الاستخدام", "ملفات تعريف الارتباط", "قبول الكل", "جميع الحقوق محفوظة", "اتصل بنا", "من نحن", "شارك", "اقرأ المزيد", "بحث", "إعلان", "خريطة الموقع", "من ويكيبيديا، الموسوعة الحرة", "هذه المقالة عن", "لمعلومات عن معان", "طالع"],
  hi: ["मुख्य सामग्री पर जाएं", "मुख्य मेनू", "लॉग इन", "लॉग आउट", "साइन अप", "सदस्यता लें", "गोपनीयता नीति", "उपयोग की शर्तें", "कुकीज़", "सभी अधिकार सुरक्षित", "संपर्क करें", "हमारे बारे में", "साझा करें", "और पढ़ें", "खोजें", "विज्ञापन"],
  tr: ["içeriğe atla", "ana menü", "giriş yap", "çıkış yap", "kayıt ol", "abone ol", "bülten", "gizlilik politikası", "kullanım koşulları", "çerez", "tümünü kabul et", "tüm hakları saklıdır", "bize ulaşın", "hakkımızda", "paylaş", "devamını oku", "ara", "reklam", "site haritası"],
  pl: ["przejdź do treści", "menu główne", "zaloguj się", "wyloguj się", "zarejestruj się", "subskrybuj", "newsletter", "polityka prywatności", "regulamin", "pliki cookie", "akceptuj wszystkie", "wszelkie prawa zastrzeżone", "kontakt", "o nas", "udostępnij", "czytaj więcej", "szukaj", "reklama", "mapa serwisu"],
  id: ["langsung ke konten", "menu utama", "masuk", "keluar", "daftar", "berlangganan", "buletin", "kebijakan privasi", "syarat dan ketentuan", "kami menggunakan cookie", "terima semua", "hak cipta dilindungi", "hubungi kami", "tentang kami", "bagikan", "baca selengkapnya", "cari", "iklan", "peta situs"],
});

// `STRONG`  phrases specific enough that ONE hit makes a short unit (<= 40 word tokens) chrome whatever else it says: an affiliate
// or sponsorship disclosure, a newsletter or sign-up promo, an endorsement disclaimer, a documentation badge, a widget help line.
// (Broader phrases stay in CHROME, which needs the phrase to cover a share of the unit.)
export const STRONG = Object.freeze({
  en: ["affiliate commission", "affiliate links", "may earn a commission", "this post may contain", "thanks for supporting the site", "sign up to get", "receive regular emails", "other subscribers", "we do not endorse", "advertising on our site", "helps support our mission", "this feature is well established", "baseline widely available", "calendar notifications", "are updated with the completion", "thank you for your interest in"],
  es: ["enlaces de afiliado", "puede contener enlaces", "recibe correos regulares", "no respaldamos"],
  fr: ["liens d'affiliation", "peut contenir des liens", "nous n'approuvons pas"],
  de: ["affiliate-links", "kann werbelinks enthalten", "wir empfehlen keine"],
  pt: ["links de afiliados", "pode conter links", "não endossamos"],
  it: ["link di affiliazione", "può contenere link", "non sosteniamo"],
});

export const WALL = Object.freeze({
  en: [
    "access denied", "access issue", "403 forbidden", "402 payment", "complete the challenge", "complete the security challenge", "checking your connection", "challenge-platform", "cf-chl", "prove you are not a bot", "prove you're not a robot", "verifying you are human", "attention required", "pardon our interruption", "please enable cookies", "request blocked", "you have been blocked", "you've been blocked", "403 forbidden", "429 too many requests", "too many requests",
    "just a moment", "checking your browser", "checking if the site connection is secure", "verify you are human", "verify that you are human", "verify you're a human", "are you a robot", "are you a human",
    "robot or human", "unusual traffic", "attention required", "pardon our interruption",
    "enable javascript and cookies", "please enable cookies", "complete the security check",
    "temporarily blocked",
    "page not found", "this page doesn't exist", "this page does not exist", "page can't be found", "page cannot be found", "no longer available", "is no longer available",
    "has expired", "this listing has expired", "this job has expired", "this job is no longer", "position has been filled", "link has expired", "link is no longer",
    "member-only story", "member only story", "members only", "only available to members", "exclusive to members", "sign in to continue", "log in to continue", "log in to view", "sign in to view", "login required",
    "subscribe to continue", "subscribe to read", "subscribe to unlock", "subscribers only", "for subscribers", "subscription required", "create a free account to continue", "register to continue", "register to read",
    "you've reached your", "you have reached your", "read the full story",
    "this page will automatically refresh", "should be up and moving shortly", "hands full at the moment", "you are in line", "you're in line", "you are in the queue", "waiting room", "estimated wait", "your place in line", "we're experiencing high traffic",
    "service unavailable", "bad gateway", "internal server error",
    "access to this page has been denied",
    "accept cookies to continue",
  ],
  es: ["acceso denegado", "verifica que eres humano", "no soy un robot", "página no encontrada", "ya no está disponible", "ha caducado", "inicia sesión para continuar", "suscríbete para continuar", "solo para suscriptores", "tráfico inusual"],
  fr: ["accès refusé", "vérifiez que vous êtes humain", "je ne suis pas un robot", "page introuvable", "n'est plus disponible", "a expiré", "connectez-vous pour continuer", "abonnez-vous pour continuer", "réservé aux abonnés", "trafic inhabituel"],
  de: ["zugriff verweigert", "bestätigen sie, dass sie ein mensch sind", "ich bin kein roboter", "seite nicht gefunden", "nicht mehr verfügbar", "ist abgelaufen", "melden sie sich an, um fortzufahren", "nur für abonnenten", "ungewöhnlicher datenverkehr"],
  pt: ["acesso negado", "verifique que você é humano", "não sou um robô", "página não encontrada", "não está mais disponível", "expirou", "entre para continuar", "somente para assinantes", "tráfego incomum"],
  it: ["accesso negato", "verifica di essere umano", "non sono un robot", "pagina non trovata", "non è più disponibile", "è scaduto", "accedi per continuare", "solo per abbonati", "traffico insolito"],
  nl: ["toegang geweigerd", "ik ben geen robot", "pagina niet gevonden", "niet meer beschikbaar", "is verlopen", "log in om door te gaan", "ongebruikelijk verkeer"],
  ru: ["доступ запрещен", "доступ запрещён", "подтвердите, что вы человек", "я не робот", "страница не найдена", "больше не доступна", "срок истёк", "войдите, чтобы продолжить", "необычный трафик"],
  zh: ["访问被拒绝", "訪問被拒絕", "请验证您是真人", "我不是机器人", "页面不存在", "找不到页面", "已不可用", "已过期", "已過期", "请登录后继续", "異常流量", "异常流量"],
  ja: ["アクセスが拒否", "アクセスできません", "ロボットではありません", "ページが見つかりません", "掲載は終了", "有効期限が切れ", "ログインして続け", "会員限定", "異常なトラフィック"],
  ko: ["접근이 거부", "로봇이 아닙니다", "페이지를 찾을 수 없습니다", "더 이상 사용할 수 없", "만료되었습니다", "로그인하여 계속", "비정상적인 트래픽"],
  ar: ["تم رفض الوصول", "لست روبوتا", "الصفحة غير موجودة", "لم تعد متاحة", "انتهت صلاحية", "سجل الدخول للمتابعة", "حركة مرور غير عادية"],
});

// `WALL_WEAK` words that are usually a wall's own furniture but can be MENTIONED in a real page ("most forms use a captcha"):
// they make a short page a wall only when they cover a real share of it, never by one passing hit.
export const WALL_WEAK = Object.freeze({
  en: ["captcha", "paywall", "security check", "unusual activity", "automated access", "automated requests", "bot detection", "queue-it", "ray id", "reference id", "incident id", "support id", "ddos protection", "not a robot"],
  es: ["captcha", "verificación de seguridad"], fr: ["captcha", "vérification de sécurité"], de: ["captcha", "sicherheitsüberprüfung"], pt: ["captcha"], it: ["captcha"], nl: ["captcha"], ru: ["captcha", "капча"], zh: ["验证码", "驗證碼"], ja: ["キャプチャ", "認証コード"], ko: ["캡차"], ar: ["كابتشا"],
});
