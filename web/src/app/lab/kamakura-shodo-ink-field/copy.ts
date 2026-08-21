export type Locale = "ja" | "en";

type CopyBlock = {
  langLabel: string;
  menuOpen: string;
  menuClose: string;
  nav: {
    experience: string;
    flow: string;
    instructor: string;
    details: string;
    book: string;
  };
  hero: {
    photoAlt: string;
    vertical: string;
    eyebrow: string;
    headline: string;
    lead: string;
    cta: string;
    secondary: string;
  };
  marquee: string;
  experience: {
    kicker: string;
    title: string;
    body: string;
    values: string[];
  };
  audience: {
    kicker: string;
    title: string;
    points: string[];
  };
  flow: {
    kicker: string;
    title: string;
    lead: string;
    steps: Array<{ time: string; text: string }>;
  };
  includes: {
    kicker: string;
    title: string;
    items: string[];
    notes: string[];
  };
  instructor: {
    kicker: string;
    title: string;
    body: string;
    points: string[];
    note: string;
  };
  online: {
    kicker: string;
    title: string;
    body: string;
    points: string[];
    badge: string;
  };
  details: {
    kicker: string;
    title: string;
    facts: Array<{ label: string; value: string }>;
    note: string;
  };
  book: {
    kicker: string;
    title: string;
    body: string;
    cta: string;
  };
  footer: string;
};

export const copy: Record<Locale, CopyBlock> = {
  ja: {
    langLabel: "言語",
    menuOpen: "メニューを開く",
    menuClose: "メニューを閉じる",
    nav: {
      experience: "体験",
      flow: "流れ",
      instructor: "講師",
      details: "詳細",
      book: "予約",
    },
    hero: {
      photoAlt: "外国人が筆と墨で書道を体験している様子",
      vertical: "鎌倉の書",
      eyebrow: "鎌倉 · 少人数 · 文化体験",
      headline: "旅の記憶に、一文字を残す。",
      lead: "プロの書道家が案内する、静かな少人数の書道体験。文字の形だけでなく、意味と文化に触れる時間です。道具はすべて用意。初心者も歓迎します。",
      cta: "日程を相談する",
      secondary: "体験を見る",
    },
    marquee: "書 × 鎌倉 × 教育 × 日本文化 × 少人数プレミアム",
    experience: {
      kicker: "Experience",
      title: "教室ではなく、文化の時間。",
      body: "書道を「文字の練習」だけで終わらせません。鎌倉という文脈のなかで、筆・墨・漢字の意味・静かな集中を体験するプレミアムな時間として設計しています。作品は持ち帰れ、飾れ、語れます。",
      values: ["本物", "上質", "静けさ", "学び", "信頼"],
    },
    audience: {
      kicker: "For whom",
      title: "景色以上の旅を求める人へ。",
      points: [
        "文化的価値・本物感・パーソナルな指導に対価を払える旅行者",
        "記念旅行・夫婦・家族で、特別な時間を残したい方",
        "日本文化への関心が高く、作品を持ち帰りたい方",
        "一般的な観光だけでは物足りないリピーター",
      ],
    },
    flow: {
      kicker: "Flow",
      title: "約90分の流れ",
      lead: "標準は約90分。余裕のある120分案では、鎌倉の季節やお茶・交流を足せます。",
      steps: [
        { time: "10分", text: "受付・挨拶・会場の説明" },
        { time: "10分", text: "書道と道具の文化背景" },
        { time: "15分", text: "筆の持ち方・基本の線" },
        { time: "10分", text: "漢字の意味とお手本選び" },
        { time: "20分", text: "練習" },
        { time: "15分", text: "清書・作品制作" },
        { time: "10分", text: "鑑賞・写真・持ち帰り説明" },
      ],
    },
    includes: {
      kicker: "Includes",
      title: "体験に含まれるもの",
      items: [
        "筆・墨・紙など道具一式",
        "書道家による少人数指導",
        "持ち帰れる書作品",
        "写真撮影（許可の範囲で）",
      ],
      notes: [
        "手ぶらで参加できます",
        "墨で汚れる可能性がある服装は避けてください",
        "会場は鎌倉市内のレンタルスペース（確定後に案内）",
      ],
    },
    instructor: {
      kicker: "Instructor",
      title: "書と教育の両方から伝える。",
      body: "専門的に書を学んだ書道家が、高校での指導経験と、外国人への日本語・書道指導の経験を活かして案内します。技術だけでなく、文字の意味と文化の背景まで丁寧に伝えます。",
      points: [
        "書道を専門に学んだ経歴（大学・専門学校）",
        "書道師範、および高校書道・国語の教員免許",
        "都立高校での書道・国語指導",
        "外国人・インターナショナルスクール生への指導経験",
        "書道教室の運営経験",
      ],
      note: "資格・学歴の正式名称は、公開前に証明書と照合して確定します。師弟関係などの国内書道界の肩書は、事業上は表に出しません。",
    },
    online: {
      kicker: "Online",
      title: "帰国後も、学びを続けられるように。",
      body: "対面体験と並ぶもう一つの柱として、海外向けオンライン書道教室を設計中です。鎌倉にいる書家から、漢字の意味や文化ごと学ぶ継続の時間を目指しています。",
      points: [
        "Trial Lesson（約60分）から小さく検証予定",
        "ライブ指導と作品添削を組み合わせる構想",
        "まずは対面体験の反応を見てから本格公開",
      ],
      badge: "Coming soon",
    },
    details: {
      kicker: "Session",
      title: "セッション概要",
      facts: [
        { label: "所要時間", value: "約1.5〜2時間" },
        { label: "定員", value: "最大5名程度" },
        { label: "会場", value: "鎌倉市内" },
        { label: "価格", value: "¥20,000 / 人" },
      ],
      note: "価格・時間・定員は市場投入前の仮説です（未検証）。会場住所・キャンセル規定は確定次第掲載します。",
    },
    book: {
      kicker: "Book",
      title: "まずは日程から。",
      body: "最初の予約受付は Activity Japan を予定しています。公開までのあいだ、日程のご相談はこのページの導線（レイアウト確認用）で受け付け想定です。",
      cta: "日程をリクエスト",
    },
    footer: "Kamakura Culture Studio · 鎌倉から、書と日本文化を世界へ",
  },
  en: {
    langLabel: "Language",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    nav: {
      experience: "Experience",
      flow: "Flow",
      instructor: "Host",
      details: "Details",
      book: "Book",
    },
    hero: {
      photoAlt: "Guests practicing Japanese calligraphy with brush and ink",
      vertical: "KAMAKURA",
      eyebrow: "Kamakura · Small group · Cultural sitting",
      headline: "Write Japan into your journey.",
      lead: "A quiet, small-group calligraphy experience guided by a professional calligrapher. Not just strokes — meaning, culture, and calm focus. Tools provided. Beginners welcome.",
      cta: "Reserve a session",
      secondary: "See the experience",
    },
    marquee: "Shodō × Kamakura × Education × Japanese culture × Small-group premium",
    experience: {
      kicker: "Experience",
      title: "Not a classroom. A cultural sitting.",
      body: "Calligraphy here is more than practicing letters. In the context of Kamakura, you meet brush, ink, the meaning of characters, and a quiet hour of focus — then leave with a piece you can display and talk about.",
      values: ["Authentic", "Elegant", "Calm", "Educational", "Trustworthy"],
    },
    audience: {
      kicker: "For whom",
      title: "Travelers who want more than sightseeing.",
      points: [
        "Guests who value culture, authenticity, and personal guidance",
        "Couples, families, and friends on a meaningful trip",
        "Travelers curious about Japanese culture who want a keepsake",
        "Repeat visitors looking beyond standard sightseeing",
      ],
    },
    flow: {
      kicker: "Flow",
      title: "About 90 minutes",
      lead: "The standard session is about 90 minutes. A 120-minute option can add Kamakura season stories, tea, and a little more conversation.",
      steps: [
        { time: "10 min", text: "Welcome · settle in · venue briefing" },
        { time: "10 min", text: "Calligraphy tools and cultural background" },
        { time: "15 min", text: "How to hold the brush · basic lines" },
        { time: "10 min", text: "Choose characters and their meaning" },
        { time: "20 min", text: "Practice" },
        { time: "15 min", text: "Final piece on washi" },
        { time: "10 min", text: "Viewing · photos · take-home notes" },
      ],
    },
    includes: {
      kicker: "Includes",
      title: "What’s included",
      items: [
        "All tools — brush, ink, paper, and more",
        "Small-group guidance by a calligrapher",
        "A finished piece to take home",
        "Photos (with permission)",
      ],
      notes: [
        "Come empty-handed",
        "Wear clothes you don’t mind getting ink on",
        "Venue: a rental space in Kamakura (details once confirmed)",
      ],
    },
    instructor: {
      kicker: "Instructor",
      title: "Craft and teaching, together.",
      body: "Your host is a calligrapher trained in the craft, with experience teaching shodō and Japanese language — including to international learners. Guidance covers technique, meaning, and cultural context.",
      points: [
        "Formal study of calligraphy (university and specialized school)",
        "Calligraphy master credentials; teaching licenses in shodō and Japanese",
        "Teaching shodō and Japanese at a Tokyo metropolitan high school",
        "Experience teaching international residents and school students",
        "Experience running a calligraphy classroom",
      ],
      note: "Formal credential names will be confirmed against certificates before public launch. Domestic calligraphy lineage titles are not used in our public materials.",
    },
    online: {
      kicker: "Online",
      title: "Continue after you leave Japan.",
      body: "Alongside the Kamakura sitting, we are designing online lessons for learners abroad — learning characters, culture, and calm focus directly from a calligrapher based in Kamakura.",
      points: [
        "Starting small with a ~60-minute trial lesson",
        "Live guidance plus feedback on your work",
        "Full launch after we learn from in-person guests",
      ],
      badge: "Coming soon",
    },
    details: {
      kicker: "Session",
      title: "At a glance",
      facts: [
        { label: "Duration", value: "About 1.5–2 hours" },
        { label: "Group", value: "Up to ~5 guests" },
        { label: "Place", value: "Kamakura, Japan" },
        { label: "Price", value: "¥20,000 / person" },
      ],
      note: "Price, duration, and capacity are working hypotheses before market launch. Exact venue address and cancellation terms will be published once confirmed.",
    },
    book: {
      kicker: "Book",
      title: "Start with a date.",
      body: "First bookings are planned through Activity Japan. Until the listing is live, treat the button below as a layout placeholder for date requests.",
      cta: "Request a date",
    },
    footer: "Kamakura Culture Studio · From Kamakura to the world, through calligraphy",
  },
};
