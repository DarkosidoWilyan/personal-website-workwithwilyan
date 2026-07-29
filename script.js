/* script.js — progressive enhancement. The page works without it:
 * content is rendered by build.js, and every style below is gated
 * behind the `.js` class added here.
 */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ------------------------------------------------------- reveal-once ------
 * One orchestrated entrance, staggered by DOM index. One-shot: never
 * re-fires on scroll. Reduced motion: everything is simply visible.
 */
function initReveal() {
  if (reducedMotion.matches) return;

  document.documentElement.classList.add("js");

  const targets = document.querySelectorAll(".title, .block, .footer");
  targets.forEach((el, i) => {
    el.setAttribute("data-reveal", "");
    el.style.setProperty("--i", String(i));
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
  );

  targets.forEach((el) => observer.observe(el));
}

/* ------------------------------------------------------- copy email -------
 * mailto: rows on the signboard get a COPY button. The label swap is the
 * feedback — no toast. Silent success, visible result.
 */
function initCopyEmail() {
  const links = document.querySelectorAll("a[data-copyable]");

  links.forEach((link) => {
    const address = link.getAttribute("href").replace(/^mailto:/i, "");
    const item = link.closest(".sign__item");
    if (!address || !item) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "sign__copy";
    button.textContent = "Copy";
    button.setAttribute("aria-label", `Copy email address ${address}`);

    let timer = null;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(address);
      } catch {
        // Clipboard unavailable (permissions, non-secure context) —
        // selecting the link text is the fallback; nothing to toast.
        return;
      }
      button.dataset.state = "copied";
      button.textContent = "Copied ✓";
      clearTimeout(timer);
      timer = setTimeout(() => {
        delete button.dataset.state;
        button.textContent = "Copy";
      }, 2500);
    });

    item.appendChild(button);
  });
}

initReveal();
initCopyEmail();
