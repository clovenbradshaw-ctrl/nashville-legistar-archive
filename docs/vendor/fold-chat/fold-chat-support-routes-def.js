// fold-chat-support-routes-def.js — GENERATED from fold-chat-support-routes.json by scripts/gen-support-routes.mjs. Never hand-edit.
// The declarative definition of the kind "creator-support-route" and its sub-kinds (docs/CREATOR-SUPPORT-ROUTES.md).
const deepFreeze = (o) => { if (o && typeof o === "object") { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
export const SUPPORT_ROUTES = deepFreeze({
 "schema": "SupportRoutes@1",
 "kind": "creator-support-route",
 "what": "A way, published by the creator's OWN page or site, for a person to support them or reach them: a tip page they can open, a feed that names them, structured data that declares a donate action, a rel=payment link, an email, a contact form. Found by this typed definition and its addresses, never by a string scan and never from a registry, WHOIS, RDAP, IP or hosting lookup.",
 "giver": "the-fold, 2026-10-05, from the user's request 'try these routes, create a definition so we can search holographically for these types of things'. Platform and word lists are DECLARED by hand (Constitution II.11), not measured.",
 "doc": "docs/CREATOR-SUPPORT-ROUTES.md",
 "standing": {
  "default": "nomination",
  "prereg": "docs/CREATOR-SUPPORT-ROUTES-PREREG.md",
  "measured": "see docs/CREATOR-SUPPORT-ROUTES-PREREG.md (Results): ten real pages, a small preliminary measurement; nothing here has standing in the wild"
 },
 "order": [
  "tip-link",
  "structured-donate",
  "rel-payment",
  "feed-author",
  "email",
  "form",
  "social-profile",
  "website"
 ],
 "outcomeOrder": [
  "tip",
  "email",
  "form",
  "social",
  "website"
 ],
 "budget": {
  "extraFetchesRoutes2and3": 2,
  "contactPages": 2,
  "pauseMs": 1200,
  "sameSiteOnly": true,
  "directDoorOnly": [
   "humans.txt"
  ],
  "note": "the page itself is read once; a card that already holds what the page offered loads nothing on the click"
 },
 "never": [
  "construct a handle or URL (a published link is used as published, minus tracking and prefilled-amount parameters)",
  "pay, prefill an amount, or collect payment details",
  "look up a registry, WHOIS, RDAP, IP-owner or hosting provider",
  "read security.txt (that is for vulnerability reports)",
  "read anything on another site than the creator's own",
  "hand an address (where it was found) to the model"
 ],
 "address": {
  "what": "where a finding sits, held by the record, never handed to the model, so the record can re-expand it",
  "shape": {
   "page": "the page URL it was found on",
   "node": "the element kind (a, link, json-ld, form, mailto-link, text, feed, humans)",
   "range": "[start, end) in UTF-8 bytes of the page text as read, or null when the finding is derived",
   "unit": "utf8-bytes"
  }
 },
 "platforms": [
  {
   "id": "kofi",
   "name": "Ko-fi",
   "class": "creator",
   "hosts": [
    "ko-fi.com"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "home",
    "s",
    "explore",
    "manage",
    "post",
    "gold",
    "about",
    "login",
    "signup",
    "api",
    "i",
    "c",
    "gallery",
    "shop",
    "commissions",
    "feed",
    "privacy",
    "terms",
    "faq",
    "help",
    "blog",
    "creators",
    "widgets"
   ],
   "example": "https://ko-fi.com/maria"
  },
  {
   "id": "buymeacoffee",
   "name": "Buy Me a Coffee",
   "class": "creator",
   "hosts": [
    "buymeacoffee.com",
    "bmc.link"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "about",
    "explore",
    "pricing",
    "widget",
    "login",
    "signup",
    "privacy",
    "terms",
    "blog",
    "help",
    "creators",
    "features",
    "discover",
    "app",
    "extras"
   ],
   "example": "https://www.buymeacoffee.com/maria"
  },
  {
   "id": "patreon",
   "name": "Patreon",
   "class": "creator",
   "hosts": [
    "patreon.com"
   ],
   "paths": [
    [
     "{h}"
    ],
    [
     "c",
     "{h}"
    ],
    [
     "join",
     "{h}"
    ],
    {
     "seg": [
      "user"
     ],
     "requireQuery": [
      "u"
     ]
    }
   ],
   "keepQuery": [
    "u"
   ],
   "reserved": [
    "posts",
    "home",
    "login",
    "signup",
    "about",
    "pricing",
    "explore",
    "creators",
    "apps",
    "policy",
    "legal",
    "collection",
    "product",
    "c",
    "join",
    "user",
    "settings",
    "messages",
    "bePatron",
    "checkout",
    "search",
    "blog",
    "app",
    "terms"
   ],
   "example": "https://www.patreon.com/maria"
  },
  {
   "id": "paypalme",
   "name": "PayPal.Me",
   "class": "creator",
   "hosts": [
    "paypal.me"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "about",
    "help"
   ],
   "example": "https://paypal.me/maria"
  },
  {
   "id": "paypal-donate",
   "name": "PayPal donate",
   "class": "creator",
   "hosts": [
    "paypal.com"
   ],
   "paths": [
    [
     "paypalme",
     "{h}"
    ],
    {
     "seg": [
      "donate"
     ],
     "requireQuery": [
      "hosted_button_id",
      "campaign_id"
     ]
    },
    {
     "seg": [
      "donate",
      "*"
     ],
     "requireQuery": [
      "hosted_button_id",
      "campaign_id"
     ]
    }
   ],
   "keepQuery": [
    "hosted_button_id",
    "campaign_id"
   ],
   "reserved": [],
   "example": "https://www.paypal.com/donate/?hosted_button_id=ABC123"
  },
  {
   "id": "github-sponsors",
   "name": "GitHub Sponsors",
   "class": "creator",
   "hosts": [
    "github.com"
   ],
   "paths": [
    [
     "sponsors",
     "{h}"
    ]
   ],
   "reserved": [
    "explore",
    "dashboard",
    "signup",
    "community",
    "accounts",
    "login",
    "tiers",
    "pricing",
    "featured",
    "faq",
    "about"
   ],
   "example": "https://github.com/sponsors/maria"
  },
  {
   "id": "liberapay",
   "name": "Liberapay",
   "class": "creator",
   "hosts": [
    "liberapay.com"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "about",
    "explore",
    "help",
    "login",
    "sign-up",
    "on",
    "search",
    "assets",
    "donate",
    "for",
    "legal",
    "privacy",
    "terms",
    "welcome",
    "stats",
    "about"
   ],
   "example": "https://liberapay.com/maria"
  },
  {
   "id": "opencollective",
   "name": "Open Collective",
   "class": "creator",
   "hosts": [
    "opencollective.com"
   ],
   "paths": [
    [
     "{h}"
    ],
    [
     "{h}",
     "donate"
    ],
    [
     "{h}",
     "contribute",
     "*"
    ]
   ],
   "reserved": [
    "discover",
    "create",
    "pricing",
    "home",
    "search",
    "signin",
    "signup",
    "help",
    "about",
    "hosts",
    "collectives",
    "e2c",
    "public",
    "static",
    "tos",
    "privacy",
    "organizations",
    "pledges",
    "how-it-works",
    "dashboard",
    "become-a-sponsor",
    "login",
    "contact",
    "docs"
   ],
   "example": "https://opencollective.com/maria"
  },
  {
   "id": "stripe-donate",
   "name": "Stripe donation page",
   "class": "creator",
   "hosts": [
    "donate.stripe.com"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [],
   "example": "https://donate.stripe.com/abc123XYZ"
  },
  {
   "id": "stripe-pay",
   "name": "Stripe payment link",
   "class": "creator",
   "needsWords": true,
   "hosts": [
    "buy.stripe.com"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [],
   "example": "https://buy.stripe.com/abc123XYZ",
   "note": "a payment link is also how a STORE sells a product, so it counts only when the link's own words say tip/donate/support"
  },
  {
   "id": "cashapp",
   "name": "Cash App",
   "class": "creator",
   "hosts": [
    "cash.app"
   ],
   "paths": [
    [
     "${h}"
    ]
   ],
   "reserved": [],
   "example": "https://cash.app/$maria"
  },
  {
   "id": "venmo",
   "name": "Venmo",
   "class": "creator",
   "hosts": [
    "venmo.com"
   ],
   "paths": [
    [
     "{h}"
    ],
    [
     "u",
     "{h}"
    ]
   ],
   "reserved": [
    "about",
    "help",
    "legal",
    "business",
    "login",
    "signup",
    "pay",
    "charge",
    "code",
    "transfer"
   ],
   "example": "https://venmo.com/u/maria"
  },
  {
   "id": "substack",
   "name": "Substack (subscribe or tip)",
   "class": "creator",
   "needsWords": true,
   "subdomainRequired": true,
   "hosts": [
    "substack.com"
   ],
   "paths": [
    [
     "subscribe"
    ],
    [
     "tip"
    ]
   ],
   "reserved": [],
   "example": "https://maria.substack.com/subscribe",
   "note": "a plain 'Subscribe' or 'Mailing list' is usually a FREE sign-up and does not count; the link's words must say tip/donate/support"
  },
  {
   "id": "gumroad",
   "name": "Gumroad (tip)",
   "class": "creator",
   "needsWords": true,
   "hosts": [
    "gumroad.com"
   ],
   "paths": [
    [
     "l",
     "{h}"
    ]
   ],
   "reserved": [],
   "example": "https://maria.gumroad.com/l/tip",
   "note": "Gumroad is mostly a store; counts only when the link's own words say tip/donate/support"
  },
  {
   "id": "afdian",
   "name": "Afdian (爱发电)",
   "class": "creator",
   "hosts": [
    "afdian.com",
    "afdian.net",
    "ifdian.net"
   ],
   "paths": [
    [
     "a",
     "{h}"
    ],
    [
     "{h}"
    ]
   ],
   "reserved": [
    "explore",
    "login",
    "about",
    "help",
    "dashboard"
   ],
   "example": "https://afdian.com/a/maria"
  },
  {
   "id": "boosty",
   "name": "Boosty",
   "class": "creator",
   "hosts": [
    "boosty.to"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "app",
    "about",
    "help",
    "explore",
    "login",
    "terms",
    "privacy"
   ],
   "example": "https://boosty.to/maria"
  },
  {
   "id": "fanbox",
   "name": "pixiv FANBOX",
   "class": "creator",
   "hosts": [
    "fanbox.cc"
   ],
   "paths": [
    [
     "@{h}"
    ]
   ],
   "reserved": [],
   "example": "https://www.fanbox.cc/@maria"
  },
  {
   "id": "fantia",
   "name": "Fantia",
   "class": "creator",
   "hosts": [
    "fantia.jp"
   ],
   "paths": [
    [
     "fanclubs",
     "{h}"
    ]
   ],
   "reserved": [],
   "example": "https://fantia.jp/fanclubs/12345"
  },
  {
   "id": "ofuse",
   "name": "OFUSE",
   "class": "creator",
   "hosts": [
    "ofuse.me"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "about",
    "help"
   ],
   "example": "https://ofuse.me/maria"
  },
  {
   "id": "cafecito",
   "name": "Cafecito",
   "class": "creator",
   "hosts": [
    "cafecito.app"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "about",
    "help",
    "login"
   ],
   "example": "https://cafecito.app/maria"
  },
  {
   "id": "apoiase",
   "name": "Apoia.se",
   "class": "creator",
   "hosts": [
    "apoia.se"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "sobre",
    "ajuda",
    "login",
    "explorar"
   ],
   "example": "https://apoia.se/maria"
  },
  {
   "id": "tipeee",
   "name": "Tipeee",
   "class": "creator",
   "hosts": [
    "tipeee.com",
    "fr.tipeee.com"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "about",
    "help",
    "login"
   ],
   "example": "https://fr.tipeee.com/maria"
  },
  {
   "id": "utip",
   "name": "uTip",
   "class": "creator",
   "hosts": [
    "utip.io"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "about",
    "help",
    "login"
   ],
   "example": "https://utip.io/maria"
  },
  {
   "id": "steady",
   "name": "Steady",
   "class": "creator",
   "hosts": [
    "steadyhq.com",
    "steady.page"
   ],
   "paths": [
    [
     "de",
     "{h}"
    ],
    [
     "en",
     "{h}"
    ],
    [
     "{h}"
    ]
   ],
   "reserved": [
    "about",
    "help",
    "login",
    "de",
    "en"
   ],
   "example": "https://steadyhq.com/de/maria"
  },
  {
   "id": "patronite",
   "name": "Patronite",
   "class": "creator",
   "hosts": [
    "patronite.pl"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "o-nas",
    "pomoc",
    "login"
   ],
   "example": "https://patronite.pl/maria"
  },
  {
   "id": "buycoffee",
   "name": "buycoffee.to",
   "class": "creator",
   "hosts": [
    "buycoffee.to"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "about",
    "help"
   ],
   "example": "https://buycoffee.to/maria"
  },
  {
   "id": "bunq",
   "name": "bunq.me",
   "class": "creator",
   "hosts": [
    "bunq.me"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [],
   "example": "https://bunq.me/maria"
  },
  {
   "id": "revolut",
   "name": "Revolut.me",
   "class": "creator",
   "hosts": [
    "revolut.me"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [],
   "example": "https://revolut.me/maria"
  },
  {
   "id": "wise",
   "name": "Wise (pay me)",
   "class": "creator",
   "hosts": [
    "wise.com"
   ],
   "paths": [
    [
     "pay",
     "me",
     "{h}"
    ]
   ],
   "reserved": [],
   "example": "https://wise.com/pay/me/maria"
  },
  {
   "id": "donorbox",
   "name": "Donorbox",
   "class": "processor",
   "hosts": [
    "donorbox.org"
   ],
   "paths": [
    [
     "{h}"
    ],
    [
     "embed",
     "{h}"
    ]
   ],
   "reserved": [
    "about",
    "pricing",
    "login",
    "signup",
    "nonprofit-fundraising-software",
    "blog",
    "features",
    "integrations",
    "support",
    "contact"
   ],
   "example": "https://donorbox.org/maria-fund"
  },
  {
   "id": "givebutter",
   "name": "Givebutter",
   "class": "processor",
   "hosts": [
    "givebutter.com"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "about",
    "pricing",
    "login",
    "signup",
    "blog",
    "features",
    "support",
    "contact"
   ],
   "example": "https://givebutter.com/maria"
  },
  {
   "id": "zeffy",
   "name": "Zeffy",
   "class": "processor",
   "hosts": [
    "zeffy.com"
   ],
   "paths": [
    [
     "donation-form",
     "{h}"
    ]
   ],
   "reserved": [],
   "example": "https://www.zeffy.com/donation-form/abc-123"
  },
  {
   "id": "everyorg",
   "name": "Every.org",
   "class": "processor",
   "hosts": [
    "every.org"
   ],
   "paths": [
    [
     "{h}"
    ]
   ],
   "reserved": [
    "about",
    "login",
    "signup",
    "search",
    "browse",
    "blog",
    "help",
    "donate"
   ],
   "example": "https://www.every.org/maria"
  }
 ],
 "deny": {
  "hosts": [
   "bit.ly",
   "t.co",
   "tinyurl.com",
   "ow.ly",
   "buff.ly",
   "goo.gl",
   "lnkd.in",
   "is.gd",
   "rb.gy",
   "cutt.ly",
   "shorturl.at",
   "t.ly",
   "rebrand.ly",
   "amzn.to",
   "a.co",
   "linktr.ee",
   "lnk.bio",
   "beacons.ai",
   "bio.link",
   "campsite.bio",
   "awin1.com",
   "shareasale.com",
   "anrdoezrs.net",
   "jdoqocy.com",
   "tkqlhce.com",
   "dpbolvw.net",
   "kqzyfj.com",
   "prf.hn",
   "pjtra.com",
   "pdy5.net",
   "pxf.io",
   "sjv.io",
   "evyy.net",
   "redirectingat.com",
   "skimresources.com",
   "rstyle.me",
   "shop-links.co",
   "howl.me",
   "linksynergy.com",
   "mailchi.mp",
   "list-manage.com",
   "doubleclick.net",
   "googleadservices.com",
   "adservice.google.com"
  ],
  "reason": "a shortener, link hub or tracker hides where the link goes, so it is refused unless the host is a known platform above"
 },
 "store": {
  "hosts": [
   "etsy.com",
   "amazon.com",
   "amazon.co.uk",
   "amazon.de",
   "amazon.ca",
   "ebay.com",
   "dftba.com",
   "teespring.com",
   "redbubble.com",
   "spreadshirt.com",
   "myshopify.com",
   "checkout.shopify.com",
   "shop.app"
  ],
  "pathWords": [
   "cart",
   "checkout",
   "product",
   "products",
   "shop",
   "store",
   "basket",
   "order"
  ],
  "labelWords": [
   "add to cart",
   "buy now",
   "order now",
   "shop now",
   "add to basket",
   "checkout"
  ],
  "reason": "a store checkout or product page buys a thing; it is not a way to support the creator"
 },
 "words": {
  "note": "caseless-safe: labels and these entries are lower-cased and stripped of Latin combining marks, matched as whole words (a trailing * allows more letters); entries in unspaced or affixing scripts (Han, kana, Hangul, Thai, Arabic, Devanagari) match anywhere in the label. No [A-Z] case logic. DECLARED by hand, per language; the giver is the-fold 2026-10-05.",
  "strong": {
   "en": [
    "donate",
    "donat*",
    "tip jar",
    "tip me",
    "tip the author",
    "tip the creator",
    "tip the writer",
    "tip the chef",
    "leave a tip",
    "give a tip",
    "buy me a coffee",
    "buy me a tea",
    "buy me a beer",
    "buy me a book",
    "buy me a drink",
    "buy me a ko-fi",
    "buy me lunch",
    "support me",
    "support my work",
    "support my writing",
    "support the work",
    "support the site",
    "support the blog",
    "support the channel",
    "support the creator",
    "support the author",
    "support the project",
    "support journalism",
    "support our journalism",
    "support our work",
    "support our mission",
    "support us",
    "support this site",
    "support this work",
    "support this blog",
    "support this channel",
    "support this project",
    "become a patron",
    "become a supporter",
    "become a member",
    "become a sponsor",
    "sponsor me",
    "ways to give",
    "give now",
    "make a gift",
    "make a contribution",
    "contribute to the site",
    "pledge"
   ],
   "es": [
    "apoyar",
    "apoyame",
    "apoyanos",
    "apoya mi trabajo",
    "apoya el sitio",
    "donar",
    "donacion",
    "donaciones",
    "donativo",
    "propina",
    "invitame a un cafe",
    "comprame un cafe",
    "invitame un cafe"
   ],
   "fr": [
    "soutenir",
    "soutenez",
    "me soutenir",
    "soutenir le site",
    "soutenir mon travail",
    "faire un don",
    "pourboire",
    "offrez moi un cafe",
    "offre moi un cafe",
    "payez moi un cafe",
    "dons"
   ],
   "de": [
    "unterstutzen",
    "unterstutze mich",
    "unterstutzt uns",
    "unterstuetzen",
    "spenden",
    "spende",
    "trinkgeld",
    "kauf mir einen kaffee",
    "kaufe mir einen kaffee",
    "foerderer",
    "forderer"
   ],
   "pt": [
    "apoiar",
    "apoie",
    "me apoie",
    "apoie o site",
    "doar",
    "doacao",
    "doacoes",
    "gorjeta",
    "me pague um cafe",
    "compre um cafe para mim"
   ],
   "it": [
    "sostieni",
    "sostienici",
    "sostienimi",
    "donazione",
    "donazioni",
    "offrimi un caffe",
    "mancia",
    "dona ora",
    "dona qui"
   ],
   "nl": [
    "steun mij",
    "steun ons",
    "steun de site",
    "doneer",
    "donatie",
    "fooi",
    "koop een kopje koffie"
   ],
   "pl": [
    "wesprzyj",
    "wesprzyj mnie",
    "wesprzyj nas",
    "darowizna",
    "napiwek",
    "postaw mi kawe"
   ],
   "tr": [
    "destek ol",
    "bagis",
    "bagis yap",
    "bana kahve ismarla",
    "destekle",
    "bahsis"
   ],
   "ru": [
    "поддержать",
    "поддержите",
    "поддержи",
    "донат",
    "донаты",
    "чаевые",
    "пожертвовать",
    "пожертвование",
    "угостить кофе",
    "купить кофе"
   ],
   "zh": [
    "打赏",
    "打賞",
    "赞赏",
    "贊賞",
    "赞助",
    "贊助",
    "捐赠",
    "捐贈",
    "捐助",
    "请我喝",
    "請我喝",
    "支持我",
    "支持本站",
    "爱发电",
    "愛發電",
    "支持作者"
   ],
   "ja": [
    "寄付",
    "投げ銭",
    "支援する",
    "応援する",
    "ご支援",
    "コーヒーをおごる",
    "スポンサーになる",
    "カンパ"
   ],
   "ko": [
    "후원",
    "후원하기",
    "기부",
    "도네이션",
    "커피 한잔",
    "커피 한 잔"
   ],
   "ar": [
    "تبرع",
    "تبرّع",
    "إكرامية",
    "اكرامية",
    "ادعمني",
    "ادعمنا",
    "اشتري لي قهوة",
    "اشترِ لي قهوة"
   ],
   "hi": [
    "दान",
    "दान करें",
    "सहयोग करें",
    "मुझे सपोर्ट करें"
   ]
  },
  "platformNames": {
   "note": "a platform NAME in a link label proves nothing for a link already on that platform ('Jane's Patreon' is somebody else's); it counts only for a link on the creator's OWN site (members.example.com labelled Patreon)",
   "any": [
    "patreon",
    "ko-fi",
    "kofi",
    "buymeacoffee",
    "liberapay"
   ]
  },
  "weak": {
   "note": "ambiguous alone (tech support, ad sponsors, contribution guidelines, advice tips): they never accept a link on their own; they only let a link on a known platform host through when the platform is flagged needsWords",
   "en": [
    "support",
    "sponsor",
    "sponsors",
    "contribute",
    "contributing",
    "tip",
    "tips",
    "membership",
    "give"
   ],
   "es": [
    "apoyo",
    "colabora",
    "soporte"
   ],
   "fr": [
    "soutien",
    "don"
   ],
   "de": [
    "unterstutzung",
    "support"
   ],
   "pt": [
    "apoio",
    "suporte"
   ],
   "it": [
    "sostegno",
    "supporto"
   ],
   "nl": [
    "steun"
   ],
   "pl": [
    "wsparcie"
   ],
   "tr": [
    "destek"
   ],
   "ru": [
    "поддержка"
   ],
   "zh": [
    "支持",
    "赞",
    "贊"
   ],
   "ja": [
    "支援",
    "サポート",
    "スポンサー",
    "応援"
   ],
   "ko": [
    "지원",
    "팁"
   ],
   "ar": [
    "دعم"
   ],
   "hi": [
    "सहयोग"
   ]
  },
  "newsTip": {
   "note": "a newsroom inviting INFORMATION tips (a leak, a story): the word 'tip' here is not money",
   "en": [
    "have a tip",
    "got a tip",
    "send us a tip",
    "send a tip",
    "send us tips",
    "submit a tip",
    "share a tip",
    "news tip",
    "news tips",
    "tip line",
    "tip us",
    "securedrop",
    "send us your tips",
    "tips@"
   ],
   "es": [
    "danos una pista",
    "enviano una pista",
    "envianos una pista"
   ],
   "fr": [
    "un tuyau",
    "signaler une information"
   ],
   "de": [
    "hinweis geben",
    "hinweisgeber"
   ],
   "zh": [
    "爆料",
    "新闻线索",
    "新聞線索"
   ],
   "ja": [
    "情報提供"
   ],
   "ru": [
    "сообщить новость",
    "прислать новость"
   ]
  },
  "helpdesk": {
   "note": "customer / technical support is a help desk, not a way to support the creator",
   "en": [
    "customer support",
    "technical support",
    "tech support",
    "support center",
    "support centre",
    "help center",
    "help centre",
    "contact support",
    "support ticket",
    "support team",
    "premium support",
    "support@",
    "support desk",
    "helpdesk"
   ],
   "es": [
    "soporte tecnico",
    "atencion al cliente"
   ],
   "de": [
    "kundenservice",
    "technischer support",
    "kundensupport"
   ],
   "fr": [
    "assistance technique",
    "service client",
    "support technique"
   ],
   "pt": [
    "suporte tecnico",
    "atendimento ao cliente"
   ],
   "zh": [
    "技术支持",
    "技術支援",
    "客服"
   ],
   "ja": [
    "サポートセンター",
    "カスタマーサポート",
    "サポート窓口"
   ],
   "ru": [
    "техподдержка",
    "техническая поддержка",
    "служба поддержки"
   ]
  }
 },
 "feed": {
  "genericAuthors": [
   "admin",
   "administrator",
   "editor",
   "editors",
   "staff",
   "webmaster",
   "team",
   "root",
   "author",
   "user",
   "unknown",
   "anonymous",
   "noreply"
  ],
  "maxItems": 40,
  "note": "an author name must not be a role word; a group feed with several creators names none unless an item is the page"
 },
 "zones": {
  "comment": [
   "comment",
   "respond",
   "reply",
   "replies",
   "disqus",
   "discussion",
   "ugc",
   "guestbook",
   "review"
  ],
  "chromeTags": [
   "header",
   "nav",
   "footer",
   "aside"
  ],
  "chromeTokens": [
   "footer",
   "header",
   "sidebar",
   "widget",
   "author",
   "bio",
   "byline",
   "about",
   "support",
   "donate",
   "supporter",
   "banner",
   "masthead",
   "topbar",
   "navbar",
   "menu"
  ],
  "relRefuse": [
   "sponsored",
   "ugc"
  ],
  "relPayment": [
   "payment",
   "donation",
   "donate"
  ],
  "codeForms": [
   "github.com",
   "gitlab.com",
   "codeberg.org"
  ],
  "note": "a link in a comment section or marked rel=ugc/sponsored is somebody else's; a link in the page's chrome (header, footer, sidebar, author box) is the page owner's; a link in the article body needs its own words, the page's own handle, or a declared structured / rel signal",
  "share": [
   "share",
   "sharing",
   "sharer",
   "sharethis",
   "addtoany",
   "shareaholic",
   "sharedaddy",
   "social-share",
   "tweet",
   "pin-it",
   "pinit",
   "share-buttons",
   "sharebar"
  ],
  "embed": [
   "embed",
   "twitter-tweet",
   "instagram-media",
   "tiktok-embed",
   "fb-post",
   "wp-block-embed",
   "fb-xfbml-parse-ignore",
   "bluesky-embed",
   "reddit-embed"
  ],
  "embedTags": [
   "blockquote"
  ]
 },
 "emailRules": {
  "machinery": [
   "abuse",
   "privacy",
   "legal",
   "dmca",
   "copyright",
   "security",
   "postmaster",
   "hostmaster",
   "noreply",
   "no-reply",
   "donotreply",
   "do-not-reply",
   "unsubscribe",
   "bounce",
   "bounces",
   "mailer-daemon",
   "root",
   "ssl",
   "cert",
   "spam",
   "gdpr",
   "dpo",
   "compliance",
   "billing",
   "accounts-payable",
   "account-payable",
   "accountspayable",
   "accountpayable",
   "sentry",
   "wixpress",
   "example",
   "ads",
   "advertising",
   "webmaster",
   "mediakit"
  ],
  "serviceTokens": [
   "custserv",
   "customerservice",
   "customercare",
   "customersupport",
   "care",
   "support",
   "help",
   "helpdesk",
   "service",
   "services",
   "subscription",
   "subscriptions",
   "subscribe",
   "billing",
   "order",
   "orders",
   "sales",
   "return",
   "returns",
   "shipping",
   "fulfilment",
   "fulfillment",
   "account",
   "accounts",
   "unsubscribe",
   "bounce",
   "bounces",
   "postmaster",
   "mailer-daemon",
   "mailerdaemon",
   "hostmaster",
   "noc",
   "it",
   "cs",
   "csr"
  ],
  "serviceCompounds": [
   "custserv",
   "customerserv",
   "customercare",
   "customersupport",
   "helpdesk",
   "fulfilment",
   "fulfillment",
   "subscription",
   "unsubscribe",
   "mailerdaemon",
   "postmaster",
   "hostmaster",
   "noreply",
   "donotreply"
  ],
  "servicePrefixHeads": [
   "support",
   "service",
   "services",
   "sales",
   "order",
   "orders",
   "billing",
   "shipping",
   "return",
   "returns",
   "care",
   "help",
   "account",
   "accounts"
  ],
  "servicePrefixTails": [
   "team",
   "desk",
   "dept",
   "department",
   "center",
   "centre",
   "inquiries",
   "enquiries",
   "us",
   "info"
  ],
  "freeMail": [
   "gmail.com",
   "googlemail.com",
   "outlook.com",
   "hotmail.*",
   "live.com",
   "msn.com",
   "yahoo.*",
   "ymail.com",
   "icloud.com",
   "me.com",
   "mac.com",
   "proton.me",
   "protonmail.com",
   "pm.me",
   "fastmail.com",
   "fastmail.fm",
   "aol.com",
   "gmx.*",
   "mail.com",
   "zoho.com",
   "yandex.com",
   "yandex.ru",
   "hey.com"
  ],
  "notAPersonDomains": [
   "sentry.io",
   "sentry-next.wixpress.com",
   "wixpress.com",
   "example.com",
   "example.org",
   "domain.com",
   "email.com",
   "yourdomain.com",
   "mysite.com"
  ],
  "elsewhereWords": [
   "advertis",
   "sponsor",
   "^press$",
   "media kit",
   "partnership",
   "business inquir",
   "business enquir",
   "brand",
   "licens",
   "copyright",
   "privacy",
   "career$",
   "careers$",
   "job$",
   "jobs$",
   "legal",
   "takedown"
  ],
  "contactWords": [
   "contact",
   "kontakt",
   "contacto",
   "contato",
   "impressum",
   "about",
   "über",
   "acerca",
   "à propos",
   "sobre",
   "联系",
   "聯絡",
   "关于",
   "お問い合わせ",
   "連絡",
   "연락",
   "문의",
   "اتصل",
   "تواصل",
   "संपर्क",
   "контакт"
  ],
  "contactFirst": [
   "contact",
   "kontakt",
   "contacto",
   "contato",
   "联系",
   "聯絡",
   "お問い合わせ",
   "문의"
  ]
 },
 "kinds": [
  {
   "id": "tip-link",
   "what": "A link the page publishes to the creator's OWN place to be tipped, supported or sponsored: a known platform's page (Ko-fi, Patreon, GitHub Sponsors, PayPal.Me, ...), or a page on the creator's own site whose own words say donate / support me / tip jar.",
   "yields": "tip",
   "step": 1,
   "where": [
    "the page",
    "the creator's own contact / about page",
    "humans.txt"
   ],
   "evidence": {
    "hosts": "platforms[].hosts, exact host or a subdomain, https (http is upgraded for platform hosts), default port, a creator-shaped path (platforms[].paths) whose handle is not reserved",
    "words": "words.strong in the link's text, aria-label, title, image alt or path (own-site links need these)",
    "zones": "zones.chromeTags / chromeTokens, or the page's own handle on the platform, or words.strong, for a link in the article body",
    "own": "same site (registered domain) as the page: the creator's own tip page"
   },
   "notThis": [
    {
     "id": "comment-section",
     "what": "a Patreon / Ko-fi link inside a comment, reply or review block, or marked rel=ugc or rel=sponsored: a commenter's or an advertiser's, not the creator's"
    },
    {
     "id": "other-org-donate",
     "what": "a 'donate' link to a DIFFERENT organisation or campaign (another site that is not a known platform, or a campaign page the page merely recommends)"
    },
    {
     "id": "store-checkout",
     "what": "a shop, cart, checkout or product link (Etsy, Amazon, a Shopify or Stripe product), including a payment link without tip words"
    },
    {
     "id": "lookalike-host",
     "what": "a host that only LOOKS like a platform: ko-fi.com.evil.test, ko-fi.com@evil.test, a different registered domain"
    },
    {
     "id": "shortener-tracker",
     "what": "a shortener, link hub or affiliate/ad tracker (bit.ly, linktr.ee, awin1.com ...) unless the host is a known platform"
    },
    {
     "id": "news-tip",
     "what": "a newsroom's invitation for INFORMATION tips ('Have a tip?', /tips, SecureDrop): the word tip is not money"
    },
    {
     "id": "helpdesk-support",
     "what": "customer or technical support ('Customer support', support.example.com, support@), which is a help desk"
    },
    {
     "id": "generic-platform-page",
     "what": "a platform's own marketing or index page, not a person's page (github.com/open-source/sponsors, patreon.com/explore, ko-fi.com/gold)"
    },
    {
     "id": "ambiguous-handles",
     "what": "two different pages on the same creator platform: the page may be recommending someone else, so none is offered unless one carries stronger evidence"
    },
    {
     "id": "body-link-no-evidence",
     "what": "a platform link in running prose with no words of its own, no structured / rel signal and no sign it is the page owner's handle"
    },
    {
     "id": "constructed-link",
     "what": "a link that is built rather than published: a Buy Me a Coffee widget script's data-id, a payment pointer, a urlTemplate, a bare handle in text"
    },
    {
     "id": "prefilled-amount",
     "what": "an amount or prefilled email in the link's query: the Fold never prefills, so these parameters are stripped"
    }
   ],
   "standing": "nomination",
   "address": "the anchor element: node a, range of the whole <a ...>...</a> in the page text"
  },
  {
   "id": "structured-donate",
   "what": "The page's own structured data (JSON-LD) declares how to give: a DonateAction's target or url, or a sameAs profile on a known creator platform.",
   "yields": "tip",
   "step": 2,
   "where": [
    "the page"
   ],
   "evidence": {
    "jsonld": "@type DonateAction with a target / url that is a plain https URL; sameAs entries on a creator platform with a creator-shaped path",
    "own": "a DonateAction target on the page's own site"
   },
   "notThis": [
    {
     "id": "url-template",
     "what": "a DonateAction target that is a urlTemplate with {placeholders}: it would have to be filled in, which is constructing a link"
    },
    {
     "id": "sameas-not-payment",
     "what": "a sameAs profile that is not a payment page (a social network, a code host profile, Wikipedia)"
    },
    {
     "id": "other-org-donate",
     "what": "a donate target on another site that is not a known platform"
    }
   ],
   "standing": "nomination",
   "address": "the JSON-LD script block: node json-ld, range of the <script> element"
  },
  {
   "id": "rel-payment",
   "what": "A link the page marks with rel=payment, rel=donation or rel=donate, or a rel=me link to the creator's own page on a known creator platform.",
   "yields": "tip",
   "step": 3,
   "where": [
    "the page"
   ],
   "evidence": {
    "rel": "zones.relPayment tokens on a link or a element; rel=me on a platform host with a creator-shaped path"
   },
   "notThis": [
    {
     "id": "rel-me-social",
     "what": "rel=me to a social profile (Mastodon, GitHub, Bluesky): an identity link, not a payment page"
    },
    {
     "id": "rel-monetization",
     "what": "rel=monetization carries a payment POINTER ($wallet.example/name), which would have to be rewritten into a URL: never used"
    }
   ],
   "standing": "nomination",
   "address": "the link element: node link or a, range of the tag"
  },
  {
   "id": "feed-author",
   "what": "The creator's own RSS or Atom feed (advertised by the page with rel=alternate, same site only, one fetch) names the author: managingEditor, webMaster, author, dc:creator, itunes:author. Gives a NAME for the greeting, and an address only if it passes the email rules.",
   "yields": "name",
   "step": 4,
   "where": [
    "the feed advertised by the page"
   ],
   "evidence": {
    "link": "<link rel=alternate type=application/rss+xml|atom+xml> on the same registered domain",
    "feed": "the item whose link is the page, else the feed's own author, else the single distinct creator"
   },
   "notThis": [
    {
     "id": "other-site-feed",
     "what": "a feed on another site (feedburner.com ...): never fetched"
    },
    {
     "id": "many-authors",
     "what": "a feed with several different creators and none matching the page: no name is taken (a group blog's author is not the card's)"
    },
    {
     "id": "machinery-address",
     "what": "a feed address that is a role mailbox or on another company's domain: dropped by the email rules"
    }
   ],
   "standing": "nomination",
   "address": "the feed URL and the element: node feed, range of the author element in the feed text"
  },
  {
   "id": "humans-txt",
   "what": "The site's humans.txt, read through the DIRECT door only (never a proxy: a guessed URL is not worth telling a third party about): a name, and links to the creator's own tip page.",
   "yields": "name-or-tip",
   "step": 5,
   "where": [
    "/humans.txt of the same site"
   ],
   "evidence": {
    "text": "links in the file that pass the tip-link rules"
   },
   "notThis": [
    {
     "id": "security-txt",
     "what": "security.txt is for vulnerability reports: never read"
    },
    {
     "id": "registry-lookup",
     "what": "RDAP, WHOIS, IP-owner and hosting-provider lookups return a registrar's or host's abuse desk: never made"
    }
   ],
   "standing": "nomination",
   "address": "node humans, range of the line in humans.txt"
  },
  {
   "id": "email",
   "what": "An address the page (or its own contact / about page) publishes to be written to: a mailto: link, structured data, a Cloudflare-protected link (decoded), or written out on a contact page. Opens the person's own mail app with a draft; the person sends it.",
   "yields": "email",
   "step": 6,
   "where": [
    "the page",
    "the creator's own contact / about page",
    "the feed"
   ],
   "evidence": {
    "links": "mailto:, data-cfemail, json-ld email",
    "domain": "the page's own domain, or a free-mail provider (emailRules.freeMail)"
   },
   "notThis": [
    {
     "id": "guessed-address",
     "what": "an address that is guessed or built (info@, contact@): never"
    },
    {
     "id": "machinery-mailbox",
     "what": "abuse, privacy, legal, noreply, security, webmaster... (emailRules.machinery)"
    },
    {
     "id": "service-desk",
     "what": "customer-service, orders, billing, fulfilment mailboxes (emailRules.service*)"
    },
    {
     "id": "other-company-domain",
     "what": "an address on a company that is neither the page's own site nor a free-mail provider"
    },
    {
     "id": "commented-out",
     "what": "an address inside an HTML comment: the page does not publish it"
    },
    {
     "id": "written-for-elsewhere",
     "what": "an address written next to words that say it is for ads, press, licensing, privacy, jobs (emailRules.elsewhereWords)"
    }
   ],
   "standing": "nomination",
   "address": "node mailto-link or text, range where the address sits in the page text, or null"
  },
  {
   "id": "form",
   "what": "The site's own message form: a <form> holding a <textarea> that is not a search, comment, login or subscribe form. The draft is copied and the creator's own contact page opens.",
   "yields": "form",
   "step": 7,
   "where": [
    "the page",
    "the creator's own contact / about page"
   ],
   "evidence": {
    "form": "<form> containing <textarea>"
   },
   "notThis": [
    {
     "id": "comment-form",
     "what": "a comment, search, login, subscribe or newsletter form"
    }
   ],
   "standing": "nomination",
   "address": "node form, range of the <form> element"
  },
  {
   "id": "social-profile",
   "what": "A link the page publishes to the creator's OWN profile, channel or page on a social platform (Instagram, Facebook, X, YouTube, TikTok, Pinterest, Threads, Bluesky, Mastodon, LinkedIn, Substack, Medium, GitHub, Twitch, Reddit, Telegram, Weibo, Bilibili, LINE, Kakao, VK) or a link hub the site itself links (Linktree, Beacons, Bio.link). Never visited by the Fold; opened on a click.",
   "yields": "social",
   "step": 8,
   "where": [
    "the page",
    "the creator's own contact / about page"
   ],
   "evidence": {
    "declared": "rel=me, JSON-LD sameAs, <link rel=me>",
    "zones": "header / footer / nav / aside / author box / about icon links",
    "own": "the handle matches the site's name or the credited author, or the page owner on a code forge",
    "shape": "social.platforms[].paths: a profile / channel / page path (never a post, video or share)"
   },
   "notThis": [
    {
     "id": "share-button",
     "what": "a SHARE button: sharer.php, share?url=, dialog/share, intent/tweet, intent/post, pin/create/button, whatsapp send, wa.me?text, a mailto share, linkedin shareArticle / sharing/share-offsite, t.me/share, reddit submit — by URL shape on any host"
    },
    {
     "id": "share-toolbar",
     "what": "any link inside a share toolbar (AddToAny, ShareThis, Shareaholic, class or id share / sharing / social-share) even when its URL looks like a profile"
    },
    {
     "id": "comment-profile",
     "what": "a profile link inside a comment, reply or review block, or marked rel=ugc / sponsored"
    },
    {
     "id": "embedded-post",
     "what": "a post, tweet, video or reel of someone else, or anything inside an embed / blockquote / twitter-tweet / instagram-media block"
    },
    {
     "id": "post-or-video-url",
     "what": "a URL that names a post, status, video, repository, playlist or photo rather than a profile / channel / page"
    },
    {
     "id": "lookalike-host",
     "what": "a host that only looks like the platform: instagram.com.evil.test, instagram.com@evil.test"
    },
    {
     "id": "platform-own-nav",
     "what": "a platform's own navigation or marketing page when the page is on that platform (github.com/features on a GitHub page): on a platform's own pages only the page owner's profile counts"
    },
    {
     "id": "someone-elses-profile",
     "what": "a profile in running prose or a credit that is not the page owner's: it needs rel=me / sameAs / chrome placement / a handle that matches the site or author, and two different profiles on one platform are both dropped unless both sit in the page's chrome"
    },
    {
     "id": "constructed-profile",
     "what": "a profile URL built from a guessed handle or a bare @name in text: never"
    }
   ],
   "standing": "nomination",
   "address": "the anchor, <link> or JSON-LD block it came from (node a / link / json-ld, range)"
  },
  {
   "id": "website",
   "what": "The creator's own website: the origin of the page the person is reading, opened in a new tab (noopener, noreferrer) only on their click. Derived, not searched.",
   "yields": "website",
   "step": 9,
   "where": [
    "the page URL"
   ],
   "evidence": {
    "origin": "the page's own https origin"
   },
   "notThis": [
    {
     "id": "other-site",
     "what": "any site other than the page's own origin (a link the page points to is never 'their website')"
    },
    {
     "id": "non-http",
     "what": "a page URL that is not http(s): nothing to open"
    }
   ],
   "standing": "nomination",
   "address": "node page, range null (derived from the page URL)"
  }
 ],
 "social": {
  "what": "the creator's OWN accounts, as the page publishes them. A profile / channel / page path, never a post, a video, a share link or an embed. Never visited by the Fold (no fetch): opened by the person on a click.",
  "cap": 6,
  "perPlatformMax": 2,
  "hubs": [
   "linktree",
   "beacons",
   "biolink"
  ],
  "share": {
   "note": "URL shapes that are SHARE buttons or posts, refused on any host: a path segment, or a query key, that belongs to sharing",
   "pathWords": [
    "sharer",
    "sharer.php",
    "share",
    "share.php",
    "intent",
    "pin",
    "send",
    "dialog",
    "embed",
    "sharearticle",
    "sharing",
    "plugins",
    "tr",
    "oembed",
    "hashtag",
    "submit",
    "status",
    "statuses",
    "post",
    "posts",
    "video",
    "videos",
    "watch",
    "p",
    "reel",
    "reels",
    "tv",
    "stories",
    "story.php",
    "permalink.php",
    "photo",
    "photos",
    "i",
    "explore",
    "search",
    "feed",
    "hashtags",
    "sharing"
   ],
   "queryKeys": [
    "u",
    "url",
    "text",
    "via",
    "hashtags",
    "shareurl",
    "mini",
    "summary",
    "source",
    "redirect_uri"
   ],
   "hosts": [
    "api.whatsapp.com",
    "web.whatsapp.com",
    "wa.me",
    "whatsapp.com",
    "flipboard.com",
    "tumblr.com"
   ],
   "note2": "tumblr and whatsapp are not creator-profile platforms here; wa.me / whatsapp send links are share buttons"
  },
  "platforms": [
   {
    "id": "instagram",
    "name": "Instagram",
    "hosts": [
     "instagram.com"
    ],
    "paths": [
     [
      "{h}"
     ]
    ],
    "reserved": [
     "p",
     "reel",
     "reels",
     "explore",
     "accounts",
     "stories",
     "tv",
     "direct",
     "about",
     "legal",
     "developer",
     "share",
     "web",
     "privacy",
     "directory",
     "challenge"
    ],
    "example": "https://www.instagram.com/maria"
   },
   {
    "id": "facebook",
    "name": "Facebook",
    "hosts": [
     "facebook.com",
     "fb.com"
    ],
    "paths": [
     [
      "{h}"
     ],
     [
      "pages",
      "*",
      "*"
     ],
     {
      "seg": [
       "profile.php"
      ],
      "requireQuery": [
       "id"
      ]
     }
    ],
    "reserved": [
     "sharer",
     "sharer.php",
     "share",
     "share.php",
     "dialog",
     "plugins",
     "tr",
     "login",
     "groups",
     "watch",
     "events",
     "photo",
     "permalink.php",
     "story.php",
     "hashtag",
     "policies",
     "help",
     "business",
     "ads",
     "marketplace",
     "gaming",
     "reel",
     "video",
     "videos",
     "posts",
     "people",
     "public",
     "l.php",
     "pages",
     "privacy",
     "terms",
     "about",
     "recover",
     "reg",
     "settings",
     "fbml",
     "connect",
     "login.php"
    ],
    "example": "https://www.facebook.com/maria"
   },
   {
    "id": "x",
    "name": "X / Twitter",
    "hosts": [
     "x.com",
     "twitter.com"
    ],
    "paths": [
     [
      "{h}"
     ]
    ],
    "reserved": [
     "intent",
     "share",
     "home",
     "search",
     "hashtag",
     "i",
     "explore",
     "login",
     "tos",
     "privacy",
     "settings",
     "compose",
     "signup",
     "about",
     "messages",
     "notifications",
     "widgets.js",
     "web",
     "download",
     "en"
    ],
    "example": "https://x.com/maria"
   },
   {
    "id": "youtube",
    "name": "YouTube",
    "hosts": [
     "youtube.com"
    ],
    "paths": [
     [
      "@{h}"
     ],
     [
      "channel",
      "{h}"
     ],
     [
      "c",
      "{h}"
     ],
     [
      "user",
      "{h}"
     ],
     [
      "{h}"
     ]
    ],
    "reserved": [
     "watch",
     "embed",
     "shorts",
     "playlist",
     "results",
     "feed",
     "live",
     "hashtag",
     "about",
     "premium",
     "c",
     "channel",
     "user",
     "results",
     "feed",
     "gaming",
     "music",
     "kids",
     "tv",
     "t",
     "shorts",
     "playlist",
     "upload",
     "account",
     "reporthistory",
     "howyoutubeworks",
     "creators",
     "ads",
     "new",
     "test",
     "s"
    ],
    "example": "https://www.youtube.com/@maria"
   },
   {
    "id": "tiktok",
    "name": "TikTok",
    "hosts": [
     "tiktok.com"
    ],
    "paths": [
     [
      "@{h}"
     ]
    ],
    "reserved": [],
    "example": "https://www.tiktok.com/@maria"
   },
   {
    "id": "pinterest",
    "name": "Pinterest",
    "hosts": [
     "pinterest.com"
    ],
    "paths": [
     [
      "{h}"
     ]
    ],
    "reserved": [
     "pin",
     "pin-builder",
     "ideas",
     "search",
     "topics",
     "_",
     "business",
     "login",
     "create",
     "today",
     "about",
     "settings",
     "explore",
     "news_hub",
     "categories"
    ],
    "example": "https://www.pinterest.com/maria"
   },
   {
    "id": "threads",
    "name": "Threads",
    "hosts": [
     "threads.net",
     "threads.com"
    ],
    "paths": [
     [
      "@{h}"
     ]
    ],
    "reserved": [],
    "example": "https://www.threads.com/@maria"
   },
   {
    "id": "bluesky",
    "name": "Bluesky",
    "hosts": [
     "bsky.app"
    ],
    "paths": [
     [
      "profile",
      "{h}"
     ]
    ],
    "reserved": [],
    "example": "https://bsky.app/profile/maria.bsky.social"
   },
   {
    "id": "mastodon",
    "name": "Mastodon",
    "hosts": [],
    "paths": [
     [
      "@{h}"
     ],
     [
      "users",
      "{h}"
     ]
    ],
    "reserved": [],
    "example": "https://social.example/@maria",
    "anyHost": true,
    "relOnly": true
   },
   {
    "id": "linkedin",
    "name": "LinkedIn",
    "hosts": [
     "linkedin.com"
    ],
    "paths": [
     [
      "in",
      "{h}"
     ],
     [
      "company",
      "{h}"
     ],
     [
      "school",
      "{h}"
     ]
    ],
    "reserved": [],
    "example": "https://www.linkedin.com/in/maria"
   },
   {
    "id": "substack",
    "name": "Substack",
    "hosts": [
     "substack.com"
    ],
    "paths": [
     [
      "@{h}"
     ],
     []
    ],
    "reserved": [],
    "example": "https://maria.substack.com/",
    "subdomainOk": true
   },
   {
    "id": "medium",
    "name": "Medium",
    "hosts": [
     "medium.com"
    ],
    "paths": [
     [
      "@{h}"
     ],
     []
    ],
    "reserved": [],
    "example": "https://medium.com/@maria",
    "subdomainOk": true
   },
   {
    "id": "github",
    "name": "GitHub",
    "hosts": [
     "github.com"
    ],
    "paths": [
     [
      "{h}"
     ]
    ],
    "reserved": [
     "features",
     "marketplace",
     "enterprise",
     "team",
     "login",
     "mcp",
     "why-github",
     "security",
     "solutions",
     "sponsors",
     "about",
     "pricing",
     "explore",
     "topics",
     "collections",
     "settings",
     "notifications",
     "new",
     "issues",
     "pulls",
     "search",
     "orgs",
     "readme",
     "customer-stories",
     "resources",
     "open-source",
     "contact",
     "site",
     "apps",
     "trending",
     "join",
     "signup",
     "codespaces",
     "copilot",
     "sitemap",
     "premium-support",
     "events",
     "stars"
    ],
    "example": "https://github.com/maria"
   },
   {
    "id": "twitch",
    "name": "Twitch",
    "hosts": [
     "twitch.tv"
    ],
    "paths": [
     [
      "{h}"
     ]
    ],
    "reserved": [
     "directory",
     "videos",
     "p",
     "downloads",
     "jobs",
     "turbo",
     "settings",
     "login",
     "signup",
     "search",
     "friends",
     "subscriptions"
    ],
    "example": "https://www.twitch.tv/maria"
   },
   {
    "id": "reddit",
    "name": "Reddit",
    "hosts": [
     "reddit.com"
    ],
    "paths": [
     [
      "user",
      "{h}"
     ],
     [
      "u",
      "{h}"
     ],
     [
      "r",
      "{h}"
     ]
    ],
    "reserved": [],
    "example": "https://www.reddit.com/user/maria",
    "community": [
     "r"
    ]
   },
   {
    "id": "telegram",
    "name": "Telegram",
    "hosts": [
     "t.me",
     "telegram.me"
    ],
    "paths": [
     [
      "{h}"
     ]
    ],
    "reserved": [
     "share",
     "joinchat",
     "addstickers",
     "iv",
     "proxy",
     "login",
     "c",
     "s"
    ],
    "example": "https://t.me/maria"
   },
   {
    "id": "weibo",
    "name": "Weibo",
    "hosts": [
     "weibo.com"
    ],
    "paths": [
     [
      "{h}"
     ],
     [
      "u",
      "{h}"
     ]
    ],
    "reserved": [
     "login",
     "signup"
    ],
    "example": "https://weibo.com/u/12345"
   },
   {
    "id": "bilibili",
    "name": "Bilibili",
    "hosts": [
     "bilibili.com"
    ],
    "paths": [
     [
      "{h}"
     ]
    ],
    "reserved": [
     "video",
     "read",
     "bangumi",
     "v"
    ],
    "example": "https://space.bilibili.com/12345",
    "spaceOnly": true
   },
   {
    "id": "line",
    "name": "LINE",
    "hosts": [
     "line.me",
     "lin.ee"
    ],
    "paths": [
     [
      "ti",
      "p",
      "{h}"
     ],
     [
      "R",
      "ti",
      "p",
      "{h}"
     ],
     [
      "{h}"
     ]
    ],
    "reserved": [
     "R",
     "ti",
     "download",
     "en",
     "ja",
     "th"
    ],
    "example": "https://line.me/ti/p/maria"
   },
   {
    "id": "kakao",
    "name": "KakaoStory",
    "hosts": [
     "story.kakao.com"
    ],
    "paths": [
     [
      "{h}"
     ]
    ],
    "reserved": [],
    "example": "https://story.kakao.com/maria"
   },
   {
    "id": "vk",
    "name": "VK",
    "hosts": [
     "vk.com"
    ],
    "paths": [
     [
      "{h}"
     ]
    ],
    "reserved": [
     "share.php",
     "away.php",
     "login",
     "feed",
     "video",
     "wall",
     "id"
    ],
    "example": "https://vk.com/maria"
   },
   {
    "id": "linktree",
    "name": "Linktree",
    "hosts": [
     "linktr.ee"
    ],
    "paths": [
     [
      "{h}"
     ]
    ],
    "reserved": [
     "s",
     "login",
     "admin",
     "privacy"
    ],
    "example": "https://linktr.ee/maria",
    "hub": true
   },
   {
    "id": "beacons",
    "name": "Beacons",
    "hosts": [
     "beacons.ai"
    ],
    "paths": [
     [
      "{h}"
     ]
    ],
    "reserved": [
     "i",
     "login",
     "signup"
    ],
    "example": "https://beacons.ai/maria",
    "hub": true
   },
   {
    "id": "biolink",
    "name": "Bio.link",
    "hosts": [
     "bio.link"
    ],
    "paths": [
     [
      "{h}"
     ]
    ],
    "reserved": [
     "login",
     "signup"
    ],
    "example": "https://bio.link/maria",
    "hub": true
   }
  ],
  "note3": "a second profile on one platform is kept only when the page declared it (rel=me / sameAs), it carries the site's or author's name, or it is the page owner on a code forge; a link hub counts only when declared or carrying the owner's name; a community (a subreddit) likewise"
 }
});
