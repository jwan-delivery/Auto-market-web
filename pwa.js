(() => {
  "use strict";

  const installCard = document.getElementById("installCta");
  const installButton = document.getElementById("installAppBtn");
  const installHelp = document.getElementById("installHelp");
  let installPrompt = null;

  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    navigator.standalone === true;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);

  function showInstallCard(label, help) {
    if (!installCard || isStandalone()) return;
    installCard.hidden = false;
    installButton.textContent = label;
    installHelp.textContent = help;
  }

  function hideInstallCard() {
    if (installCard) installCard.hidden = true;
  }

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", {scope:"/"})
        .catch(error => console.warn("تعذر تفعيل وضع التطبيق:", error));
    });
  }

  if (!isStandalone()) {
    if (isIOS) {
      showInstallCard("طريقة التثبيت", "في Safari اضغط «مشاركة» ثم اختر «إضافة إلى الشاشة الرئيسية».");
    } else if (isAndroid) {
      showInstallCard("تثبيت التطبيق", "يمكنك تثبيته من هنا، أو من قائمة المتصفح ⋮ ثم «تثبيت التطبيق».");
    }
  } else {
    hideInstallCard();
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    showInstallCard("تثبيت التطبيق", "ثبّت الملهلب كتطبيق مستقل على هاتفك.");
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    hideInstallCard();
    if (typeof toast === "function") toast("تم تثبيت تطبيق الملهلب بنجاح.");
  });

  installButton?.addEventListener("click", async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      installPrompt = null;
      if (choice && choice.outcome === "accepted") hideInstallCard();
      return;
    }

    if (isIOS) {
      if (typeof toast === "function") toast("اضغط زر المشاركة في Safari ثم «إضافة إلى الشاشة الرئيسية».");
    } else if (isAndroid) {
      if (typeof toast === "function") toast("افتح قائمة المتصفح ⋮ واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».");
    } else if (typeof toast === "function") {
      toast("استخدم خيار «تثبيت التطبيق» من قائمة المتصفح.");
    }
  });

  const navButtons = Array.from(document.querySelectorAll("[data-app-nav]"));
  navButtons.forEach(button => {
    button.addEventListener("click", () => {
      const target = button.dataset.appNav;
      navButtons.forEach(item => item.removeAttribute("aria-current"));

      if (target === "home") {
        document.querySelector(".hero")?.scrollIntoView({behavior:"smooth",block:"start"});
      } else if (target === "search") {
        const search = document.getElementById("search");
        search?.scrollIntoView({behavior:"smooth",block:"center"});
        search?.focus({preventScroll:true});
      } else if (target === "filters") {
        document.querySelector(".side-panel")?.scrollIntoView({behavior:"smooth",block:"start"});
      } else if (target === "account") {
        document.getElementById("loginBtn")?.click();
      }

      button.setAttribute("aria-current","page");
    });
  });
})();
