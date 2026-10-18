/** Hafif, bağımlılıksız kutlama efekti + motivasyon mesajları. */

const EMOJIS = ["🎉", "⭐", "🔥", "✨", "🏆", "💎", "🚀"];

export function burstConfetti(count = 18) {
  if (typeof document === "undefined") return;
  const layer = document.createElement("div");
  layer.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(layer);

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.textContent = EMOJIS[Math.floor(Math.random() * EMOJIS.length)]!;
    const left = 20 + Math.random() * 60;
    const dur = 900 + Math.random() * 900;
    piece.style.cssText = `position:absolute;top:-6%;left:${left}%;font-size:${
      14 + Math.random() * 16
    }px;opacity:0;will-change:transform,opacity`;
    layer.appendChild(piece);
    piece.animate(
      [
        { transform: "translateY(0) rotate(0deg)", opacity: 1 },
        {
          transform: `translateY(90vh) translateX(${
            Math.random() * 160 - 80
          }px) rotate(${Math.random() * 720 - 360}deg)`,
          opacity: 0,
        },
      ],
      { duration: dur, easing: "cubic-bezier(.2,.6,.3,1)", delay: Math.random() * 220 },
    );
  }

  window.setTimeout(() => layer.remove(), 2400);
}

const CORRECT_MESSAGES = [
  "Harika! 🎯",
  "Tam isabet! ⭐",
  "Bunu biliyordun! 💪",
  "Süpersin! 🚀",
  "Doğru cevap! ✨",
];

const WRONG_MESSAGES = [
  "Olsun, bir sonrakinde! 💙",
  "Bunu not al, tekrar karşına çıkacak. 📌",
  "Yaklaştın! Açıklamayı oku. 🔍",
  "Yanlış da öğrenmenin parçası. 🌱",
];

export function feedbackMessage(correct: boolean) {
  const pool = correct ? CORRECT_MESSAGES : WRONG_MESSAGES;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

/** Seri (combo) kilometre taşları için kutlama metni. */
export function streakMessage(streak: number): string | null {
  if (streak === 3) return "3'lü seri! 🔥 Bonus puanlar akıyor.";
  if (streak === 5) return "5'li seri! ⚡ Şimdi durma.";
  if (streak === 10) return "10'lu seri! 🏆 Efsane gidiyorsun.";
  if (streak > 10 && streak % 10 === 0) return `${streak}'lu seri! 👑 İnanılmaz.`;
  return null;
}
