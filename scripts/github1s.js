export default {
  icon: "https://github1s.com/favicon-dark.svg",
  name: {
    en: "Open repo in github1s.com",
    vi: "Mở repo trong github1s.com",
  },
  description: {
    en: "Open current repo in github1s.com",
    vi: "Mở repo hiện tại trong trang github1s.com để xem code",
  },
  blackList: [],
  whiteList: ["github.com"],

  func: function () {
    window.open("https://www.github1s.com" + location.pathname);
  },
};