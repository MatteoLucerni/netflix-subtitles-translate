(function () {
  var STORE_URL = "https://chromewebstore.google.com/detail/PLACEHOLDER_ID";

  function apply() {
    var links = document.querySelectorAll("[data-store-link]");
    for (var i = 0; i < links.length; i++) {
      links[i].setAttribute("href", STORE_URL);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", apply);
  } else {
    apply();
  }
})();
