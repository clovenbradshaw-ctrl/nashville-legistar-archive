// native/adapters/text/askshape-lens.multilingual.js — twenty-five-language
// lens registry for the harm shape.
//
// The kernel (organs/askshape.js) is MEDIUM-BLIND: it judges the SHAPE from
// arms, never from a word. A LENS is one language's own grammar — the surfaces
// that name a collapse. This file is twenty-five of them (spa fra deu por ita
// rus arb cmn_hans jpn kor hin swa tur heb ind nld pol ukr ces swe ell vie
// tha fas dan), each a MINIMAL attested surface set
// for the three arms and the affirming inverse; a native speaker refines each.
// What they demonstrate is the point of the split: the SAME kernel returns the
// SAME verdict in every language, because the language lives in the lens.
//
// THE EXISTENCE FACE IS A KIND, NOT A WORD LIST (2026-09-19). The `voids` arm
// is read language-NEUTRALLY by the hyperlexicon kind tier
// (kernel/foreclosing-kinds.js): the construction object's KIND is resolved
// through the reaction substrate against the charter's protected rights, so
// "bomba"/"Bombe"/"бомбу"/"炸弹"/"爆弾"/"قنبلة"/"बम"/"폭탄" all resolve the SAME
// foreclosing kind. What stays per-language HERE — the grammar of seeking —
// is the `acquire` frame (how one asks for the thing itself, not a report of
// it) and the `aboutFrame` that reads a means through as a topic. A bare kind
// name is inert without a seek frame; a history/education ask never carries
// one, and an about-frame reads the means through regardless.
//
// \b is deliberately NOT used for CJK/Arabic/Devanagari/Thai: it is
// ASCII-anchored and breaks on those scripts. Surfaces are plain substrings
// (case-folded where the script has case).

import { resolveForeclosingKind } from "../../kernel/foreclosing-kinds.js";
import { seekObject } from "./seek-object.js";

const build = (giver, lang, s) => ({
  giver, lang,
  arms: (text, { charter = null } = {}) => {
    const t = String(text ?? "");
    // THE SEEK FRAME (2026-09-19, falsified live): "como fazer uma bomba" and
    // "بمب بساز" leaked because the per-language `acquire` wordlists were
    // incomplete (fazer / بساز missing). The seek frame is GRAMMAR — a
    // construction verb governing an object — and seek-object.js already
    // detects it mechanically, language-neutrally (no POS prior, no weapon
    // wordlist). `acquire` is the frame's presence; the lens's own surface is
    // kept only as an OR so nothing already working regresses.
    const so = seekObject(t, { language: lang });
    return {
      experience: s.experience.test(t),
      humanity: s.humanity.test(t),
      autonomy: s.autonomy.test(t),
      capability: s.acts.test(t),
      inherent: false, // the demo rests on the SHAPE (act + collapse), not a bare name
      remedy: s.remedy.test(t),
      understand: (s.understand ?? /$^/).test(t),
      create: (s.create ?? /$^/).test(t),
      instrumentalCreate: (s.instrumentalCreate ?? /$^/).test(t),
      override: (s.override ?? /$^/).test(t),
      other: s.other.test(t),
      // THE EXISTENCE FACE: the `voids` arm is the KIND of the construction's
      // object, resolved language-neutrally by the hyperlexicon kind tier
      // (an unlicensed composition is withheld — a disclosed coverage gap,
      // never a verdict). The seek frame (`acquire`) is the construction
      // frame's mechanical presence; the about-frame that reads a means
      // through (`aboutFrame`) stays per-language grammar HERE.
      voids: resolveForeclosingKind(t, { charter }).foreclosing,
      acquire: so.found || (s.acquire ?? /$^/).test(t),
      atScale: (s.atScale ?? /$^/).test(t),
      selfForeclose: (s.selfForeclose ?? /$^/).test(t),
      aboutFrame: (s.aboutFrame ?? /$^/).test(t),
    };
  },
});

// A shared seeking-surface for the Romance/Germanic cognates below: the making
// or obtaining of the means, across languages that share the roots. Each
// surface is the grammar of ASKING FOR THE THING, never the topic held as
// knowledge — a history/education sentence carries none of these.
const ACQUIRE_LATN = /\bsintet\w*|\bsynth\w*|\bfabric\w*|\bherstell\w*|\bprodu\w*|\benriqu\w*|\banreicher\w*|\bcultiv\w*|\bkultiv\w*|\bweaponi\w*|\bmilitariz\w*|\bconstru\w*|\bassembl\w*|\bmontar|\bmonter|\bbau\w*|\breceta|\brecette|\brezept|\bcome\s+(?:fare|costruire)|\bcómo\s+(?:hacer|fabricar|construir)|\bcomment\s+(?:fabriquer|construire)|\bwie\s+(?:man\s+)?(?:baut|herstellt)|\bpaso\s+a\s+paso|\bpas\s+à\s+pas|\bschritt\s+für\s+schritt|\bhoe\s+(?:bouw|maak|maakt|vervaardig)\s+je|\bjak\s+(?:zbudować|zrobić|stworzyć|wytworzyć)|\bjak\s+(?:postavit|udělat|vyrobit|vytvořit)|\bhur\s+(?:man\s+)?(?:bygger|gör|tillverkar)|πώς\s+να\s+(?:φτιάξεις|φτιάξω|κάνεις|κατασκευάσεις|φτιάχνεις)|\bhvordan\s+(?:man\s+)?(?:bygger|bygge|laver)/iu;

// The about-frame per language: the means held as knowledge, not sought as
// capacity — history/education/incidents read a foreclosing kind through.
// Plain substrings for CJK/Arabic/Devanagari (no word boundaries).
const ABOUT = {
  spa: /historia\s+de|historia\s+del/i,
  fra: /histoire\s+d|histoire\s+de/i,
  deu: /geschichte\s+von|geschichte\s+der/i,
  por: /hist[óo]ria\s+d/i,
  ita: /storia\s+de/i,
  rus: /история/,
  arb: /تاريخ/,
  cmn_hans: /的历史|历史/,
  jpn: /の歴史|歴史/,
  kor: /의\s*역사|역사/,
  hin: /का\s+इतिहास|इतिहास/,
  swa: /historia\s+ya/i,
  tur: /tarihi|tarihçe/i,
  heb: /היסטוריה/,
  ind: /sejarah/i,
  nld: /geschiedenis\s+van/i,
  pol: /historia|historii/i,
  ukr: /історія|історі/,
  ces: /historie|historie\s+/i,
  swe: /historia/i,
  ell: /ιστορία|ιστορί/,
  vie: /lịch\s+sử/,
  tha: /ประวัติศาสตร์/,
  fas: /تاریخچه|تاریخ/,
  dan: /historien\s+om|historie/i,
};

// The seek frames (acquire) for the non-Latin-script lenses, and the handful
// of Latin-script frames ACQUIRE_LATN's shared roots do not carry.
const ACQUIRE = {
  spa: ACQUIRE_LATN,
  fra: ACQUIRE_LATN,
  deu: ACQUIRE_LATN,
  por: ACQUIRE_LATN,
  ita: ACQUIRE_LATN,
  nld: ACQUIRE_LATN,
  pol: ACQUIRE_LATN,
  ces: ACQUIRE_LATN,
  swe: ACQUIRE_LATN,
  ell: ACQUIRE_LATN,
  dan: ACQUIRE_LATN,
  rus: /как\s+(?:сделать|создать|построить|изготовить)/,
  arb: /كيف\s+تصنع|طريقة\s+صنع|كيفية\s+صنع/,
  cmn_hans: /制造|制作|建造|如何\s*做/,
  jpn: /作り方|作り|作る|作っ|製造/,
  kor: /만드는\s*(?:법|방법)|만들|제조/,
  hin: /बनाने\s+का\s+तरीका|कैसे\s+बनाएं|बनाना|कैसे\s+बनाना/,
  swa: /jinsi\s+ya\s+(?:kutengeneza|kuunda|kujenga)/,
  tur: /nasıl\s+yapılır|nasıl\s+yap|yapmak|yapımı/,
  heb: /איך\s+(?:בונים|מכינים|עושים|לבנות)/,
  ind: /cara\s+(?:membuat|membangun|merakit)/,
  ukr: /як\s+(?:зробити|створити|побудувати|виготовити)/,
  tha: /วิธี\s*ทำ/,
  fas: /چگونه\s+(?:بمب\s+)?(?:بسازیم|ساخت|ساختن)|طریقه\s+ساخت/,
  vie: /cách\s+(?:làm|chế\s+tạo)/,
};

export const LENSES = {
  spa: build("español", "spa", {
    acts: /keylogger|roba|malware|esp[ií]a/i,
    experience: /v[ií]ctima/i, humanity: /alima[ñn]a|escoria|subhumano/i, autonomy: /sin\s+(?:su\s+)?consentimiento|a\s+escondidas|sin\s+que\s+lo\s+sepan/i,
    remedy: /proteg|denunci|ayud|informar/i, other: /v[ií]ctima|usuari/i, understand: /analiz|resum|explic|traduc/i, create: /escrib|crea|program|desarroll|implement|haz|genera/i,
    acquire: ACQUIRE.spa, aboutFrame: ABOUT.spa,
  }),
  fra: build("français", "fra", {
    acts: /keylogger|vole|malware|espion/i,
    experience: /victime/i, humanity: /vermine|sous-?humain|racaille/i, autonomy: /à\s+leur\s+insu|sans\s+(?:leur\s+)?consentement|en\s+secret/i,
    remedy: /protég|signal|aid|défend|dénonc/i, other: /victime|utilisateur/i, understand: /analys|résum|expliqu|tradui/i, create: /écri|ecri|cré|programm|développ|implement|fais|génèr/i,
    acquire: ACQUIRE.fra, aboutFrame: ABOUT.fra,
  }),
  deu: build("Deutsch", "deu", {
    acts: /keylogger|stiehl|stiehlt|stehlen|malware|spion/i,
    experience: /opfer/i, humanity: /untermensch|abschaum|ungeziefer/i, autonomy: /ohne\s+(?:deren|ihr)\s+wissen|ohne\s+wissen|heimlich/i,
    remedy: /schütz|meld|hilf|verteidig|bekämpf/i, other: /opfer|nutzer|benutzer/i, understand: /analys|zusammenfass|erklär|übersetz/i, create: /schreib|erstelle|programmier|entwickl|implementier|mach|generier/i,
    acquire: ACQUIRE.deu, aboutFrame: ABOUT.deu,
  }),
  por: build("português", "por", {
    acts: /keylogger|rouba|malware|espi/i,
    experience: /v[ií]tima/i, humanity: /verme|escória|subumano/i, autonomy: /sem\s+(?:o\s+)?consentimento|às\s+escondidas|sem\s+que\s+saibam/i,
    remedy: /proteg|denunci|ajud|informar/i, other: /v[ií]tima|usuári/i, understand: /analis|resum|explic|traduz/i, create: /escrev|cria|program|desenvolv|implement|faça|ger[ae]/i,
    acquire: ACQUIRE.por, aboutFrame: ABOUT.por,
  }),
  ita: build("italiano", "ita", {
    acts: /keylogger|ruba|malware|spia/i,
    experience: /vittim/i, humanity: /verme|feccia|subumano/i, autonomy: /senza\s+(?:il\s+loro\s+)?consenso|di\s+nascosto|senza\s+che\s+sappiano/i,
    remedy: /protegg|denunci|aiut|difend/i, other: /vittim|utent/i, understand: /analiz|riassum|spieg|tradu/i, create: /scriv|crea|programm|svilupp|implement|fai|genera/i,
    acquire: ACQUIRE.ita, aboutFrame: ABOUT.ita,
  }),
  rus: build("русский", "rus", {
    acts: /кейлоггер|крад|малвар|шпион/i,
    experience: /жертв/i, humanity: /недочеловек|отброс|насеком/i, autonomy: /без\s+их\s+согласия|без\s+согласия|без\s+их\s+ведома|втайне/i,
    remedy: /защищ|сообщ|помог|борьб|разоблач/i, other: /жертв|пользовател/i, understand: /анализ|резюм|объясн|перевед/i, create: /напиш|созда|разработ|запрограммир|реализуй|сделай/i,
    acquire: ACQUIRE.rus, aboutFrame: ABOUT.rus,
  }),
  arb: build("العربية", "arb", {
    acts: /تجسس|يسرق|سرقة|برنامج ضار/i,
    experience: /ضحايا|الضحية/i, humanity: /حشرات|أوباش|دون البشر/i, autonomy: /دون علم|بدون علم|دون علمهم|خلسة|سرا/i,
    remedy: /يحمي|حماي|الحماية|الإبلاغ|بلّغ|بلاغ|ساعد/i, other: /ضحايا|المستخدم|مستخدم/i, understand: /تحليل|حلّل|حلل|لخّص|اشرح|ترجم/i, create: /اكتب|أنشئ|انشئ|برمج|طور|اصنع|ولّد/i,
    acquire: ACQUIRE.arb, aboutFrame: ABOUT.arb,
  }),
  cmn_hans: build("简体中文", "cmn_hans", {
    acts: /键盘记录|窃取|恶意软件|间谍/i,
    experience: /受害者/i, humanity: /害虫|人渣|非人|低等/i, autonomy: /不知情|未经同意|未经许可|偷偷|秘密地/i,
    remedy: /保护|举报|帮助|揭露|反对/i, other: /受害者|用户/i, understand: /分析|总结|解释|翻译/i, create: /写|创建|编写|开发|制作|做|生成/i,
    acquire: ACQUIRE.cmn_hans, aboutFrame: ABOUT.cmn_hans,
  }),
  jpn: build("日本語", "jpn", {
    acts: /キーロガー|盗|マルウェア|スパイ/i,
    experience: /被害者/i, humanity: /害虫|クズ|非人間|下等/i, autonomy: /同意なく|同意なし|知らないうちに|こっそり|秘密裏/i,
    remedy: /保護|通報|助け|支援|告発/i, other: /被害者|ユーザー/i, understand: /分析|要約|説明|翻訳/i, create: /書いて|書き|作成|作って|開発|実装|生成/i,
    acquire: ACQUIRE.jpn, aboutFrame: ABOUT.jpn,
  }),
  kor: build("한국어", "kor", {
    acts: /키로거|훔|악성|스파이/i,
    experience: /피해자/i, humanity: /해충|쓰레기|비인간|열등/i, autonomy: /몰래|동의\s*없이|모르게|비밀/i,
    remedy: /보호|신고|도와|지원|고발/i, other: /피해자|사용자/i, understand: /분석|요약|설명|번역/i, create: /작성|만들|짜|개발|구현|생성/i,
    acquire: ACQUIRE.kor, aboutFrame: ABOUT.kor,
  }),
  hin: build("हिन्दी", "hin", {
    acts: /कीलॉगर|चुरा|मैलवेयर|जासूस/i,
    experience: /पीड़ित/i, humanity: /कीट|कचरा|अमानवीय|निचला/i, autonomy: /बिना\s+जानकारी|जानकारी\s+के\s+बिना|बिना\s+सहमति|चुपके|गुप्त/i,
    remedy: /रक्षा|बचाव|रिपोर्ट|मदद|समर्थन/i, other: /पीड़ित|उपयोगकर्ता/i, understand: /विश्लेष|सारांश|समझा|अनुवाद/i, create: /लिख|बना|विकसित|बनाओ|कोड|बनाए/i,
    acquire: ACQUIRE.hin, aboutFrame: ABOUT.hin,
  }),
  swa: build("Kiswahili", "swa", {
    acts: /keylogger|iba|malware|upelelezi/i,
    experience: /waathirika/i, humanity: /wadudu|takataka|sio binadamu/i, autonomy: /bila\s+ridhaa|bila\s+kujua|kwa\s+siri/i,
    remedy: /linda|ripoti|sadia|tetea/i, other: /waathirika|watumiaji|mtumiaji/i, understand: /changanua|fupisha|eleza|tafsiri/i, create: /andika|tengeneza|unda|program|jenga|buni/i,
    acquire: ACQUIRE.swa, aboutFrame: ABOUT.swa,
  }),
  tur: build("Türkçe", "tur", {
    acts: /keylogger|çal|malware|casus/i,
    experience: /kurban/i, humanity: /haşere|süprüntü|insan\s+altı/i, autonomy: /onayları\s+olmadan|haberi\s+olmadan|gizlice/i,
    remedy: /koru|bildir|yardım|savun|ifşa/i, other: /kurban|kullanıcı/i, understand: /analiz|özetle|açıkla|çevir/i, create: /yaz|oluştur|geliştir|programla|yap|üret/i,
    acquire: ACQUIRE.tur, aboutFrame: ABOUT.tur,
  }),
  heb: build("עברית", "heb", {
    acts: /קיילגר|גונב|נוזקה|ריגול/i,
    experience: /קורבנות/i, humanity: /מזיקים|אשפה|תת-?אדם/i, autonomy: /בלי\s+ידיעת|בלי\s+ידיעה|בסתר/i,
    remedy: /הגן|הגנה|דווח|לעזור|להוקיע/i, other: /קורבנות|משתמש/i, understand: /לנתח|נתח|לסכם|להסביר|לתרגם/i, create: /כתוב|צור|פתח|בנה|יישם|הפק/i,
    acquire: ACQUIRE.heb, aboutFrame: ABOUT.heb,
  }),
  ind: build("Bahasa Indonesia", "ind", {
    acts: /keylogger|curi|malware|mata-mata/i,
    experience: /korban/i, humanity: /kutu|sampah|bukan manusia/i, autonomy: /tanpa\s+sepengetahuan|tanpa\s+persetujuan|diam-diam/i,
    remedy: /lindung|laporkan|lapor|bantu|bela/i, other: /korban|pengguna/i, understand: /analis|ringkas|jelaskan|terjemah/i, create: /tulis|buat|kembangkan|program|bikin|hasilkan/i,
    acquire: ACQUIRE.ind, aboutFrame: ABOUT.ind,
  }),
  nld: build("Nederlands", "nld", {
    acts: /keylogger|steel|steelt|malware|spion/i,
    experience: /slachtoffer/i, humanity: /ongedierte|uitschot|sub-?mens/i, autonomy: /zonder\s+(?:hun\s+)?toestemming|zonder\s+(?:dat\s+ze\s+het\s+)?weten|stiekem|in\s+het\s+geheim/i,
    remedy: /bescherm|meld|help|verdedig|bestrijd/i, other: /slachtoffer|gebruik/i, understand: /analys|samenvat|uitleg|vertaal/i, create: /schrijf|maak|bouw|programmeer|ontwikkel|implementeer|genereer/i,
    acquire: ACQUIRE.nld, aboutFrame: ABOUT.nld,
  }),
  pol: build("polski", "pol", {
    acts: /keylogger|kradn|malware|szpieg/i,
    experience: /ofiar/i, humanity: /robactwo|szumowina|podcz[łl]owiek/i, autonomy: /bez\s+(?:ich\s+)?zgody|potajemnie|w\s+tajemnicy/i,
    remedy: /chron|zg[łl]oś|pomo|broni|zwalcza/i, other: /ofiar|użytkownik/i, understand: /analiz|podsum|wyjaśn|tłumacz|przetłumacz/i, create: /napis|stw[óo]rz|zbud|programuj|zaprojekt|wygeneruj|zr[óo]b/i,
    acquire: ACQUIRE.pol, aboutFrame: ABOUT.pol,
  }),
  ukr: build("українська", "ukr", {
    acts: /кейлогер|крад|шпигун|малвар/i,
    experience: /жертв/i, humanity: /недолюдок|відморозок|покид/i, autonomy: /без\s+(?:їх\s+)?згоди|таємно|потай/i,
    remedy: /захис|повідом|допом|оборон|боротьб/i, other: /жертв|користувач/i, understand: /аналіз|резюм|поясн|переклад/i, create: /напиш|створ|розроб|запрограм|зроби|згенер/i,
    acquire: ACQUIRE.ukr, aboutFrame: ABOUT.ukr,
  }),
  ces: build("čeština", "ces", {
    acts: /keylogger|krad|malware|špion/i,
    experience: /obět|oběti/i, humanity: /havěť|smetí|podlidé/i, autonomy: /bez\s+(?:jejich\s+)?souhlasu|tajně|potajmu/i,
    remedy: /chráni|nahlas|pomo|brán|boju/i, other: /obět|uživatel/i, understand: /analyz|shrn|vysvětl|přelož/i, create: /napiš|vytvo|postav|naprogramuj|navrhni|vygeneruj|udělej/i,
    acquire: ACQUIRE.ces, aboutFrame: ABOUT.ces,
  }),
  swe: build("svenska", "swe", {
    acts: /keylogger|stjäl|malware|spion/i,
    experience: /\boffer\b|\bofre\b/i, humanity: /ohyra|avskum|undermän/i, autonomy: /utan\s+(?:deras\s+)?samtycke|i\s+hemlighet|utan\s+att\s+de\s+vet/i,
    remedy: /skydda|anmäl|hjälp|försvar|bekämp/i, other: /\boffer\b|\bofre\b|användar/i, understand: /analyser|sammanfatt|förklar|översätt/i, create: /skriv|skapa|bygg|programmera|utveckla|implementera|generera/i,
    acquire: ACQUIRE.swe, aboutFrame: ABOUT.swe,
  }),
  ell: build("ελληνικά", "ell", {
    acts: /keylogger|κλέβ|κακόβουλ|κατασκοπ/i,
    experience: /θύμα|θυμάτων/i, humanity: /υπάνθρωπ|απόβρασμα|σκουπίδι/i, autonomy: /χωρίς\s+(?:τη\s+)?συγκατάθεσ|κρυφά|εν\s+αγνοία/i,
    remedy: /προστατ|καταγγέλ|βοηθ|αμύν|καταπολεμ/i, other: /θύμα|χρήστ/i, understand: /ανάλυ|σύνοψ|εξήγησ|μετάφρασε|μετάφρα/i, create: /γράψ|δημιούργησ|δημιουργ|χτίσ|προγραμμάτισε|σχεδίασε|φτιάξε|φτιάξ/i,
    acquire: ACQUIRE.ell, aboutFrame: ABOUT.ell,
  }),
  vie: build("Tiếng Việt", "vie", {
    acts: /keylogger|đánh\s+cắp|gián\s+điệp|phần\s+mềm\s+độc/i,
    experience: /nạn\s+nhân/i, humanity: /sâu\s+bọ|đồ\s+bỏ|không\s+phải\s+người/i, autonomy: /không\s+có\s+sự\s+đồng\s+ý|không\s+hay\s+biết|lén\s+lút/i,
    remedy: /bảo\s+vệ|tố\s+cáo|giúp|báo\s+cáo|phòng\s+thủ/i, other: /nạn\s+nhân|người\s+dùng/i, understand: /phân\s+tích|tóm\s+tắt|giải\s+thích|dịch/i, create: /viết|tạo|xây\s+dựng|phát\s+triển|lập\s+trình|tạo\s+ra/i,
    acquire: ACQUIRE.vie, aboutFrame: ABOUT.vie,
  }),
  tha: build("ไทย", "tha", {
    acts: /คีย์ล็อกเกอร์|ขโมย|มัลแวร์|สปายแวร์|จารกรรม/i,
    experience: /เหยื่อ/i, humanity: /แมลง|ขยะ|ไม่ใช่\s+มนุษย์/i, autonomy: /โดยไม่\s+ได้รับความยินยอม|โดยไม่รู้ตัว|แอบ/i,
    remedy: /ปกป้อง|แจ้งความ|ช่วย|รายงาน|ป้องกัน/i, other: /เหยื่อ|ผู้ใช้/i, understand: /วิเคราะห์|สรุป|อธิบาย|แปล/i, create: /เขียน|สร้าง|พัฒนา|เขียนโปรแกรม|ผลิต/i,
    acquire: ACQUIRE.tha, aboutFrame: ABOUT.tha,
  }),
  fas: build("فارسی", "fas", {
    acts: /کیلاگر|دزد|بدافزار|جاسوس/i,
    experience: /قربانی/i, humanity: /حشره|زبله|فرو-?انسان/i, autonomy: /بدون\s+(?:رضایت|اجازه)|مخفیانه|بدون\s+اطلاع/i,
    remedy: /محافظت|گزارش|کمک|دفاع|مقابله/i, other: /قربانی|کاربر/i, understand: /تحلیل|خلاصه|توضیح|ترجمه/i, create: /بنویس|ایجاد|توسعه|برنامه\s+نویسی|بساز/i,
    acquire: ACQUIRE.fas, aboutFrame: ABOUT.fas,
  }),
  dan: build("dansk", "dan", {
    acts: /keylogger|stjæl|malware|spion/i,
    experience: /\boffer\b|\bofre\b/i, humanity: /skadedyr|pak|undermenneske/i, autonomy: /uden\s+(?:deres\s+)?samtykke|uden\s+at\s+de\s+ved|i\s+hemmelighed/i,
    remedy: /beskyt|anmeld|hjælp|forsvar|bekæmp/i, other: /\boffer\b|\bofre\b|bruger/i, understand: /analyser|sammenfat|forklar|oversæt/i, create: /skriv|opret|bygg|programmer|udvikl|implementer|generer/i,
    acquire: ACQUIRE.dan, aboutFrame: ABOUT.dan,
  }),
};

export const LENS_LANGUAGES = Object.keys(LENSES);
export default LENSES;