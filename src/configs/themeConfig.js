/*
 * If you change the following items in the config object, you will not see any effect in the local development server
 * as these are stored in the cookie (cookie has the highest priority over the themeConfig):
 * 1. mode
 * 3. semiDark
 * 4. layout
 *
 * To see the effect of the above items, you can click on the reset button from the Customizer
 * which is on the top-right corner of the customizer besides the close button.
 * This will reset the cookie to the values provided in the config object below.
 *
 * Another way is to clear the cookie from the browser's Application/Storage tab and then reload the page.
 */
const themeConfig = {
  templateName: "LSMT",
  homePageUrl: "/home",
  settingsCookieName: "lsmt",
  mode: "dark", // 'light', 'dark'
  semiDark: false, // true, false
  layout: "vertical", // 'vertical', 'collapsed'
  layoutPadding: 24, // Common padding for header, content layout components (in px)
  navbar: {
    type: "fixed", // 'fixed', 'static'
    floating: false, // true, false
    detached: true, //! true, false (This will not work if floating navbar is enabled)
    blur: true, // true, false
  },
  disableRipple: false, // true, false
};

export default themeConfig;
