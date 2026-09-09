(function () {
  var links = Array.prototype.slice.call(document.querySelectorAll(".cat-link"));
  var sections = links
    .map(function (l) {
      return document.getElementById(l.dataset.target);
    })
    .filter(Boolean);

  function setActive(id) {
    links.forEach(function (l) {
      l.classList.toggle("active", l.dataset.target === id);
    });
  }

  if ("IntersectionObserver" in window && sections.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-10% 0px -70% 0px" }
    );
    sections.forEach(function (s) {
      observer.observe(s);
    });
  }

  if (sections.length) setActive(sections[0].id);
})();
