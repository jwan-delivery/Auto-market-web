(() => {
  "use strict";

  const homePage = document.getElementById("homePage");
  const homeFooter = document.getElementById("homeFooter");
  const servicePage = document.getElementById("serviceInfoPage");
  const marketPage = document.getElementById("marketPage");
  const serviceTitle = document.getElementById("servicePageTitle");
  const serviceMessage = document.getElementById("servicePageMessage");

  function goHome() {
    homePage.hidden = false;
    homeFooter.hidden = false;
    servicePage.hidden = true;
    marketPage.hidden = true;
    document.body.classList.remove("market-active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openCars() {
    homePage.hidden = true;
    homeFooter.hidden = true;
    servicePage.hidden = true;
    marketPage.hidden = false;
    document.body.classList.add("market-active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openInfo(kind) {
    const pages = {
      insurance: {
        title: "أسعار التأمين",
        message: "هنا حتلقى أسعار التأمين ومعلوماته بطريقة واضحة وسهلة. نعمل حالياً على تجهيز البيانات ونشرها."
      },
      licensing: {
        title: "أسعار الترخيص",
        message: "هنا حتلقى أسعار الترخيص وخطواته بصورة بسيطة. نعمل حالياً على تجهيز البيانات ونشرها."
      }
    };
    const page = pages[kind];
    if (!page) return;

    homePage.hidden = true;
    homeFooter.hidden = true;
    marketPage.hidden = true;
    servicePage.hidden = false;
    serviceTitle.textContent = page.title;
    serviceMessage.textContent = page.message;
    document.body.classList.remove("market-active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  document.querySelectorAll("[data-open-market]").forEach(button => {
    button.addEventListener("click", openCars);
  });

  document.querySelectorAll("[data-open-service]").forEach(button => {
    button.addEventListener("click", () => openInfo(button.dataset.openService));
  });

  document.querySelectorAll("[data-go-home]").forEach(button => {
    button.addEventListener("click", goHome);
  });
})();