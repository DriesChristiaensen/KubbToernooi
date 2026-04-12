<script setup lang="ts">
import { ref } from "vue";
import { nl } from "~/i18n/nl";

const fired = ref(false);

function throwStick() {
  if (fired.value) return;
  fired.value = true;

  const logoEl = document.querySelector<HTMLElement>(".logo-wrap");
  const headerEl = document.querySelector<HTMLElement>("header");
  if (!logoEl || !headerEl) {
    fired.value = false;
    return;
  }

  const logoRect = logoEl.getBoundingClientRect();
  const headerRect = headerEl.getBoundingClientRect();

  // Start: right edge of header, vertically centred in header
  const startX = headerRect.right - 16;
  const startY = headerRect.top + headerRect.height / 2;

  // Target: centre of logo
  const logoX = logoRect.left + logoRect.width / 2;
  const logoY = logoRect.top + logoRect.height / 2;

  // Arc apex: above the midpoint between start and logo
  const midX = (startX + logoX) / 2;
  const midY = Math.min(startY, logoY) - 70;

  // Final rest: on the bottom of the logo (stick is horizontal = 4px tall)
  const endY = logoRect.bottom - 2;

  const stick = document.createElement("div");
  stick.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 4px;
    height: 30px;
    background: linear-gradient(to right, #DAAF76, #8D714C);
    border-radius: 2px;
    pointer-events: none;
    z-index: 9999;
    transform-origin: center center;
  `;
  document.body.appendChild(stick);

  // translate(x, y) centres the stick on the target coordinate (half of 4px, half of 30px)
  const at = (x: number, y: number, deg: number) =>
    `translate(${x - 2}px, ${y - 15}px) rotate(${deg}deg)`;

  // Timing: throw ÷ 0.9 (slower), fall ÷ 1.1 (faster)
  const throwFrac = 0.628;
  const midFrac = 0.292;
  const fallSpan = 1 - throwFrac;

  // Arc fall: sin(θ) for X (fast start, eases out) and 1−cos(θ) for Y (slow start, accelerates — gravity)
  const fallFrames = Array.from({ length: 21 }, (_, i) => {
    const t = i / 20;
    const theta = (t * Math.PI) / 2;
    return {
      offset: throwFrac + t * fallSpan,
      transform: at(
        logoX + 8 + 22 * Math.sin(theta),
        logoY + (endY - logoY) * (1 - Math.cos(theta)),
        720 + 90 * t,
      ),
    };
  });

  // Stick stays in final position until page reload (no cleanup)
  stick.animate(
    [
      { offset: 0, easing: "ease-out", transform: at(startX, startY, 0) },
      { offset: midFrac, easing: "ease-out", transform: at(midX, midY, 360) },
      ...fallFrames,
    ],
    { duration: 1129, fill: "forwards" },
  );

  // At the moment of impact: rotate logo-wrap (img + shimmer together) 90° CCW, shift 12px left
  const impactDelay = Math.round(throwFrac * 1129); // ≈ 709ms
  setTimeout(() => {
    logoEl.style.transformOrigin = "40% 70%";
    // Phase 1: impact pushes logo quickly to ~20°, strong ease-out brings it to near-zero velocity
    // Phase 2: nearly balanced, gravity wins — strong ease-in accelerates it to 90°
    logoEl.animate(
      [
        { offset: 0,    easing: "cubic-bezier(0.25, 1, 0.45, 1)",  transform: "translate(0px, 0px) rotate(0deg)"        },
        { offset: 0.40, easing: "cubic-bezier(0.55, 0, 0.85, 0.3)", transform: "translate(-2.2px, 0.44px) rotate(-20deg)" },
        { offset: 1,                                                transform: "translate(-10px, 2px) rotate(-90deg)"   },
      ],
      { duration: 1000, fill: "forwards" },
    );
  }, impactDelay);
}
</script>

<template>
  <footer
    class="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-between border-t border-gray-200 bg-surface px-4 py-1.5"
  >
    <span
      :class="
        fired
          ? 'cursor-default select-none text-sm font-light text-primary/40 pointer-events-none'
          : 'cursor-pointer select-none text-sm font-light text-primary/40 transition-opacity hover:text-primary/60'
      "
      @click="throwStick"
      >By DC</span
    >
    <a
      href="https://www.chirosint-antonius.be"
      target="_blank"
      rel="noopener"
      class="text-sm font-bold text-text-light hover:text-primary"
    >
      {{ nl.footer.by }}
    </a>
  </footer>
</template>
