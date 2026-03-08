let isMobile = $state(false);
let isTablet = $state(false);
let isDesktop = $state(true);

export function createLayoutStore() {
  $effect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    const tabletQuery = window.matchMedia('(min-width: 768px) and (max-width: 1023px)');
    const desktopQuery = window.matchMedia('(min-width: 1024px)');

    function update() {
      isMobile = mobileQuery.matches;
      isTablet = tabletQuery.matches;
      isDesktop = desktopQuery.matches;
    }

    update();
    mobileQuery.addEventListener('change', update);
    tabletQuery.addEventListener('change', update);
    desktopQuery.addEventListener('change', update);

    return () => {
      mobileQuery.removeEventListener('change', update);
      tabletQuery.removeEventListener('change', update);
      desktopQuery.removeEventListener('change', update);
    };
  });

  return {
    get isMobile() {
      return isMobile;
    },
    get isTablet() {
      return isTablet;
    },
    get isDesktop() {
      return isDesktop;
    },
  };
}
