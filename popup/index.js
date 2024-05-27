import { openModal } from "./helpers/modal.js";
import { refreshSpecialTabs, getAllTabs } from "./tabs.js";
import { BADGES_CONFIG } from "../scripts/helpers/badge.js";
import { checkForUpdate } from "./helpers/checkForUpdate.js";
import { UfsGlobal } from "../scripts/content-scripts/ufs_global.js";
import { THEME, THEME_KEY, getTheme, setTheme } from "./helpers/theme.js";
import { run as enableSmoothScroll } from "../scripts/smoothScroll.js";
import {
  isActiveScript,
  getCurrentTab,
  isFunction,
  removeAccents,
  setActiveScript,
  trackEvent,
  Storage,
  checkBlackWhiteList,
  runScriptInTabWithEventChain,
} from "../scripts/helpers/utils.js";
import {
  LANG,
  LANG_KEY,
  getFlag,
  getLang,
  setLang,
  t,
} from "./helpers/lang.js";
import {
  activeTabIdSaver,
  favoriteScriptsSaver,
  recentScriptsSaver,
  disableSmoothScrollSaver,
} from "./helpers/storage.js";
import {
  canAutoRun,
  canClick,
  isTitle,
  viewScriptSource,
} from "./helpers/utils.js";
// import _ from "../md/exportScriptsToMd.js";

const settingsBtn = document.querySelector(".settings");
const reloadBtn = document.querySelector(".reload");
const tabDiv = document.querySelector("div.tab");
const contentDiv = document.querySelector("div.content");
const searchInput = document.querySelector(".search input");
const searchFound = document.querySelector(".search .searchFound");
const scrollToTopBtn = document.querySelector("#scroll-to-top");

let disableSmoothScroll = null;

// ========================================================
// ========================= Tabs =========================
// ========================================================
// #region tabs
async function createTabs() {
  // prepare tabs
  await refreshSpecialTabs();

  // clear UI
  tabDiv.innerHTML = "";
  contentDiv.innerHTML = "";

  // make new UI
  const allTabs = getAllTabs();
  for (let tab of allTabs) {
    // create tab button
    const tabBtn = document.createElement("button");
    tabBtn.className = "tablinks";
    tabBtn.innerHTML = t(tab.name);
    tabBtn.type = "button";
    tabBtn.setAttribute("content-id", tab.id);

    // show scripts count
    if (tab.customCount || tab.showCount) {
      let avaiCount =
        tab.customCount ||
        tab.scripts.filter((script) => !isTitle(script)).length;
      if (avaiCount) tabBtn.innerHTML += ` (${avaiCount})`;
    }

    // custom style
    if (tab.style && typeof tab.style === "object")
      Object.entries(tab.style).forEach(([key, value]) => {
        tabBtn.style[key] = value;
      });

    tabBtn.onclick = () => {
      trackEvent("OPEN-TAB-" + tab.id);
      openTab(tab);
    };

    tabDiv.appendChild(tabBtn);
  }

  // open tab
  let activeTabId = activeTabIdSaver.get();
  activeTabId && openTab(allTabs.find((tab) => tab.id === activeTabId));
}

async function openTab(tab) {
  activeTabIdSaver.set(tab.id);
  createTabContent(tab);

  Array.from(document.querySelectorAll(".tablinks")).forEach((_) => {
    _.classList.remove("active");
  });
  document
    .querySelector('.tablinks[content-id="' + tab.id + '"]')
    .classList.add("active");
}

async function createTabContent(tab) {
  // search bar
  let scriptsCount = tab.scripts.filter((_) => !isTitle(_)).length;
  let name = t(tab.name).replace(/<i(.*?)<\/i> /g, "");
  searchInput.value = "";
  searchInput.placeholder = t({
    vi: `Tìm trong ${scriptsCount} chức năng ${name}...`,
    en: `Search in ${scriptsCount} scripts ${name}...`,
  });
  searchInput.focus?.();

  // create tab content
  const contentContainer = document.createElement("div");
  contentContainer.className = "tabcontent";

  // create button for scripts in tabcontent
  if (!tab.scripts?.length) {
    const emptyText = document.createElement("h3");
    emptyText.style.padding = "30px 0";
    emptyText.style.color = "#19143b";
    emptyText.innerHTML = t(
      tab.placeholder || {
        en: `<i class="fa-solid fa-circle-info"></i> Nothing here yet...`,
        vi: `<i class="fa-solid fa-circle-info"></i> Chưa có gì ở đây hết...`,
      }
    );
    contentContainer.appendChild(emptyText);
  } else {
    const favoriteScriptIds = favoriteScriptsSaver.getIds();
    tab.scripts.forEach((script) => {
      let isFavorite = favoriteScriptIds.find((id) => script.id === id);
      contentContainer.appendChild(createScriptButton(script, isFavorite));
    });
  }

  // inject to DOM
  contentDiv.innerHTML = "";
  contentDiv.appendChild(contentContainer);
}

function createScriptButton(script, isFavorite = false) {
  // Section title
  if (isTitle(script)) {
    const title = document.createElement("h3");
    title.innerHTML = t(script.name);
    title.classList.add("section-title");

    return title;
  }

  // Button Container
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "buttonContainer";

  // button checker
  if (canAutoRun(script)) {
    const checkmarkContainer = document.createElement("div");
    checkmarkContainer.setAttribute("data-flow", "right");

    const checkmark = document.createElement("button");
    checkmark.className = "checkmark";
    checkmark.onclick = async (e) => {
      let oldVal = await isActiveScript(script.id);
      let newVal = !oldVal;

      if (
        (newVal && (await script.popupScript?.onEnable?.()) === false) ||
        (!newVal && (await script.popupScript?.onDisable?.()) === false)
      )
        return;

      setActiveScript(script.id, newVal);
      trackEvent(script.id + (newVal ? "-ON" : "-OFF"));
      updateButtonChecker(script, checkmarkContainer, newVal);
    };

    checkmarkContainer.appendChild(checkmark);
    buttonContainer.appendChild(checkmarkContainer);
    updateButtonChecker(script, checkmarkContainer);
  }

  // button
  const button = document.createElement("button");
  button.className = "tooltip";
  if (canClick(script)) {
    button.onclick = () => runScript(script);
  } else if (canAutoRun(script)) {
    button.onclick = () => {
      openModal(
        t({
          vi: "Chức năng này Tự động chạy",
          en: "This function is Autorun",
        }),
        t({
          vi: `<ul>
            <li>Tắt/Mở tự chạy bằng cách tích chọn ô bên trái. </li>
            <li>Sau đó tải lại trang web. </li>
          </ul>`,
          en: `<ul>
            <li>Turn on/off autorun by click the left checkmark. </li>
            <li>Then reload the webpage. </li>
          `,
        })
      );
    };
  } else {
    button.onclick = () =>
      alert(
        t({
          vi: "Chức năng chưa hoàn thành " + script.id,
          en: "Coming soon " + script.id,
        })
      );
  }

  // script badges
  if (script.badges?.length > 0) {
    const badgeContainer = document.createElement("div");
    badgeContainer.classList.add("badgeContainer");

    script.badges
      .filter((badge) => badge in BADGES_CONFIG)
      .map((badge) => {
        const { text, color, backgroundColor } = BADGES_CONFIG[badge];
        const badgeItem = document.createElement("span");
        badgeItem.classList.add("badge");
        badgeItem.innerHTML = t(text);
        badgeItem.style.color = color;
        badgeItem.style.backgroundColor = backgroundColor;

        badgeContainer.appendChild(badgeItem);
      });

    button.appendChild(badgeContainer);
  }

  // script icon
  if (script.icon && typeof script.icon === "string") {
    button.appendChild(createIcon(script.icon));
  }

  // script title
  const title = document.createElement("span");
  title.classList.add("btn-title");
  title.innerHTML = t(script.name);
  button.appendChild(title);

  const more = document.createElement("span");
  more.classList.add("more");

  // script buttons
  let scriptBtns = script.buttons ?? [];
  if (typeof script.infoLink === "string")
    scriptBtns.unshift({
      icon: `<i class="fa-regular fa-circle-question"></i>`,
      name: { en: "Info", vi: "Thông tin" },
      onClick: () => window.open(script.infoLink),
    });
  scriptBtns.forEach((btnConfig) => {
    const btn = document.createElement("div");
    btn.appendChild(createIcon(btnConfig.icon));
    btn.classList.add("more-item");
    const title = t(btnConfig.name);
    btn.setAttribute("data-tooltip", title);
    btn.setAttribute("data-flow", "left");
    btn.onclick = (e) => {
      // prevent to trigger other script's onClick funcs
      e.stopPropagation();
      e.preventDefault();
      trackEvent(script.id + "-BUTTON-" + title);
      btnConfig.onClick();
    };
    more.appendChild(btn);
  });

  // view source button
  const viewSourceBtn = document.createElement("div");
  viewSourceBtn.innerHTML = `<i class="fa-solid fa-code"></i>`;
  viewSourceBtn.className = "more-item";
  viewSourceBtn.setAttribute(
    "data-tooltip",
    t({
      en: "View script source",
      vi: "Xem mã nguồn",
    })
  );
  viewSourceBtn.setAttribute("data-flow", "left");
  viewSourceBtn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();

    trackEvent(script.id + "-VIEW-SOURCE");
    viewScriptSource(script);
  };
  more.appendChild(viewSourceBtn);

  // add to favorite button
  const addFavoriteBtn = document.createElement("div");
  addFavoriteBtn.innerHTML = `<i class="fa-solid fa-star"></i>`;
  addFavoriteBtn.className = "more-item";
  addFavoriteBtn.setAttribute("data-flow", "left");
  updateFavBtn(addFavoriteBtn, isFavorite);
  addFavoriteBtn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    trackEvent(script.id + (isFavorite ? "-REMOVE-FAVORITE" : "-ADD-FAVORITE"));
    favoriteScriptsSaver.toggle(script);
    isFavorite = !isFavorite;
    updateFavBtn(addFavoriteBtn, isFavorite);
    refreshSpecialTabs();
  };
  more.appendChild(addFavoriteBtn);

  // tooltip
  const tooltip = document.createElement("span");
  tooltip.classList.add("tooltiptext");
  tooltip.innerHTML = t(script.description);

  if (script.description?.img) {
    tooltip.innerHTML += `<img src="${script.description.img}" style="width:80vw" />`;
  }
  if (script.description?.video) {
    let video = document.createElement("video");
    video.src = script.description.video;
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.style.width = "80vw";
    // TODO why this not working??
    button.addEventListener("mouseenter", () => {
      setTimeout(() => {
        video.pause();
        video.currentTime = 0;
        video.play();
      }, 10);
    });
    button.addEventListener("mouseleave", () => {
      setTimeout(() => video.pause(), 0);
    });
    tooltip.appendChild(video);
  }
  if (script.changeLogs) {
    let tx = "";
    let dates = Object.keys(script.changeLogs).sort();
    for (let date of dates) {
      tx += `<li>${date} - ${script.changeLogs[date]}</li>`;
    }
    tooltip.innerHTML += `<ul class="change-logs">${tx}</ul>`;
  }
  button.appendChild(more);
  button.appendChild(tooltip);

  buttonContainer.appendChild(button);
  return buttonContainer;
}

function createIcon(srcOrHtml) {
  // image icon
  if (
    srcOrHtml.startsWith("/") ||
    srcOrHtml.startsWith("http://") ||
    srcOrHtml.startsWith("https://") ||
    srcOrHtml.startsWith("data:image")
  ) {
    const img = document.createElement("img");
    img.classList.add("icon-img");
    img.src = srcOrHtml;
    return img;
  }

  // text/html icon: usually fontAwesome icon
  else {
    const span = document.createElement("span");
    span.classList.add("icon-html");
    span.innerHTML = srcOrHtml;
    return span;
  }
}

function updateFavBtn(btn, isFavorite) {
  let i = btn.querySelector("i");
  i.classList.toggle("fa-regular", !isFavorite);
  i.classList.toggle("fa-solid", isFavorite);
  btn.classList.toggle("active", isFavorite);
  btn.setAttribute(
    "data-tooltip",
    isFavorite
      ? t({
          en: "Remove from favorite",
          vi: "Xoá khỏi yêu thích",
        })
      : t({
          en: "Add to farovite",
          vi: "Thêm vào yêu thích",
        })
  );
}

async function updateButtonChecker(script, checkmarkContainer, val) {
  let checkmark = checkmarkContainer.querySelector(".checkmark");
  if (!checkmark) return;
  let tooltip = "";
  if (val ?? (await isActiveScript(script.id))) {
    checkmark.classList.add("active");
    tooltip = t({
      vi: "Tắt tự chạy",
      en: "Turn off Autorun",
    });
  } else {
    checkmark.classList.remove("active");
    tooltip = t({
      vi: "Bật tự chạy",
      en: "Turn on Autorun",
    });
  }
  checkmarkContainer.setAttribute("data-tooltip", tooltip);
}

function showError(e) {
  Swal.fire({
    icon: "error",
    title: t({ vi: "Lỗi", en: "Error" }),
    text: e?.message || "",
    input: "textarea",
    inputValue: JSON.stringify(e, null, 4),
  });
}

async function runScript(script) {
  let tab = await getCurrentTab();
  let willRun = checkBlackWhiteList(script, tab.url);
  if (willRun) {
    recentScriptsSaver.add(script);
    trackEvent(script.id);

    try {
      if (isFunction(script.popupScript?.onClick))
        await script.popupScript.onClick();
    } catch (e) {
      showError(e);
    }

    [
      ["MAIN", "pageScript", "onClick", false],
      ["MAIN", "pageScript", "onClick_", true],
      ["ISOLATED", "contentScript", "onClick", false],
      ["ISOLATED", "contentScript", "onClick_", true],
    ].forEach(([world, context, func, allFrames]) => {
      if (isFunction(script?.[context]?.[func])) {
        runScriptInTabWithEventChain({
          target: {
            tabId: tab.id,
            ...(allFrames ? { allFrames: true } : {}),
          },
          scriptIds: [script.id],
          eventChain: context + "." + func,
          world: world,
        }).catch(showError);
      }
    });
  } else {
    let w = script?.whiteList?.join("<br/>");
    let b = script?.blackList?.join("<br/>");

    openModal(
      t({
        en: `Script not supported in current website`,
        vi: `Script không hỗ trợ website hiện tại`,
      }),
      t({
        en:
          `${w ? `+ Only run at:  <i>${w}</i>` : ""}<br />` +
          `${b ? `+ Not run at:  <i>${b}</i>` : ""}`,
        vi:
          `${w ? `+ Chỉ chạy tại:  <i>${w}</i>` : ""}<br />` +
          `${b ? `+ Không chạy tại:  <i>${b}</i>` : ""}`,
      })
    );
  }
}
// #endregion

// ========================================================
// ======================== Others ========================
// ========================================================
// #region others

function initTooltip() {
  settingsBtn.setAttribute(
    "data-tooltip",
    t({ vi: "Cài đặt", en: "Settings" })
  );
  reloadBtn.setAttribute(
    "data-tooltip",
    t({ vi: "Khởi động lại tiện ích", en: "Reload extension" })
  );
}

function initSettings() {
  reloadBtn.onclick = () => {
    Swal.fire({
      icon: "warning",
      title: t({
        vi: "Khởi động lại tiện ích?",
        en: "Reload extension?",
      }),
      text: t({
        vi: "Các chức năng tự chạy sẽ mất kết nối, gây lỗi => cần tải lại các trang web để hoạt động trở lại.",
        en: "Autorun scripts will be disconnected => you have to reload websites.",
      }),
      showCancelButton: true,
      confirmButtonText: t({ vi: "Khởi động lại", en: "Reload" }),
      cancelButtonText: t({ vi: "Huỷ", en: "Cancel" }),
    }).then((res) => {
      if (res.isConfirmed) chrome.runtime.reload();
    });
  };

  settingsBtn.onclick = () => {
    trackEvent("CLICK_SETTINGS");

    const body = document.createElement("div");
    body.classList.add("settings-body");

    // select language
    const langRow = document.createElement("div");
    const curLang = getLang();
    langRow.classList.add("row");
    langRow.innerHTML = `
      <div class="label">${t({ en: "Language", vi: "Ngôn ngữ" })}</div>
      <div class="right-container">
        <img src="${getFlag(curLang)}" />
        <select class="select">
        ${LANG_KEY.map(
          (key) =>
            `<option value="${key}" ${key === curLang ? "selected" : ""}>
                ${LANG[key]}
              </option>`
        ).join("")}
        </select>
      </div>
    `;
    const select = langRow.querySelector(".select");
    select.onchange = (event) => {
      let newLang = event.target.value;
      trackEvent("CHANGE-LANGUAGE-" + newLang);
      setLang(newLang);

      // reset UI
      createTabs();
      checkForUpdate();

      // re-open setting modal
      settingsBtn.click();
      initTooltip();
    };
    body.appendChild(langRow);

    // select themes
    let curThemeKey = getTheme();
    let curThem = THEME[curThemeKey];
    const themeRow = document.createElement("div");
    themeRow.classList.add("row");
    const author = curThem?.author
      ? `<a target="_blank" href="${curThem.author.link}" data-tooltip="${t({
          vi: "Tác giả: " + curThem.author.name,
          en: "Author: " + curThem.author.name,
        })}" data-flow="left">
        <img src="${curThem.author.avatar}" class="avatar" />
      </a>`
      : "";
    themeRow.innerHTML = `
      <div class="label">${t({ en: "Theme", vi: "Chủ đề" })}</div>
      <div class="right-container">
        ${author}
        <select class="select">
          ${THEME_KEY.map((key) => {
            let selected = key === curThemeKey ? "selected" : "";
            return `<option value="${key}" ${selected}>
              ${t(THEME[key])}
            </option>`;
          })}
        </select>
      </div>
    `;
    const selectTheme = themeRow.querySelector(".select");
    selectTheme.onchange = (event) => {
      let newTheme = event.target.value;
      trackEvent("CHANGE-THEME-" + newTheme);
      setTheme(newTheme);

      // re-open setting modal
      settingsBtn.click();
      initTooltip();
    };
    body.appendChild(themeRow);

    // smooth scroll row
    const smoothScrollRow = document.createElement("div");
    smoothScrollRow.classList.add("row");
    smoothScrollRow.setAttribute(
      "data-tooltip",
      t({
        vi: "Tắt nếu bạn đã cài app SmoothScroll",
        en: "Turn off if installed SmoothScroll app",
      })
    );
    smoothScrollRow.setAttribute("data-flow", "bottom");
    smoothScrollRow.innerHTML = `
      <div class="label">${t({
        vi: "Cuôn chuột siêu mượt",
        en: "Super smooth scroll",
      })}</div>
      <div class="right-container">
        <button class="checkmark"></button>
      </div>
    `;
    const checkbox = smoothScrollRow.querySelector("button");
    checkbox.classList.toggle(
      "active",
      !(disableSmoothScrollSaver.get() ?? false)
    );
    checkbox.onclick = () => {
      let curVal = disableSmoothScrollSaver.get();
      let newVal = !curVal;
      disableSmoothScrollSaver.set(newVal);

      let enabled = !newVal;
      trackEvent("CHANGE-SMOOTH-SCROLL-" + (enabled ? "ON" : "OFF"));
      checkbox.classList.toggle("active", enabled);
      if (enabled) disableSmoothScroll = enableSmoothScroll();
      else if (typeof disableSmoothScroll == "function") disableSmoothScroll();
    };
    body.appendChild(smoothScrollRow);

    openModal(
      t({
        en: "Settings",
        vi: "Cài đặt",
      }),
      body
    );
  };
}

function initSearch() {
  searchInput.addEventListener("input", (event) => {
    let keyword = event.target.value;
    let found = 0;
    let childrens = document.querySelectorAll(".tabcontent .buttonContainer");

    childrens.forEach((child) => {
      let willShow = true;
      let text = removeAccents(child.textContent).toLowerCase();
      let searchStr = removeAccents(keyword)
        .toLowerCase()
        .split(" ")
        .filter((_) => _);

      for (let s of searchStr) {
        if (text.indexOf(s) == -1) {
          willShow = false;
          break;
        }
      }
      child.classList.toggle("hide", !willShow);
      if (willShow) found++;
    });
    searchFound.innerText = keyword
      ? `${found}/${childrens.length} scripts`
      : "";
  });
}

function initTracking() {
  let trackingEles = document.querySelectorAll("[data-track]");

  trackingEles.forEach((ele) => {
    ele.onclick = () => {
      trackEvent("CLICK_" + ele.getAttribute("data-track"));
    };
  });
}

function initScrollToTop() {
  scrollToTopBtn.addEventListener("click", () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  });

  // window.addEventListener("scroll", () => {
  //   scrollToTopBtn.classList.toggle("hide", document.body.scrollTop < 200);
  // });
}

function saveScroll() {
  const scrollY = window.scrollY;
  Storage.set("popupScrollY", scrollY);
}

function restoreScroll() {
  Storage.get("popupScrollY", 0).then((value) => {
    window.scrollTo({
      top: value,
      // behavior: "smooth",
    });
  });
}

const onScrollEnd = UfsGlobal.Utils.debounce(() => {
  saveScroll();
  scrollToTopBtn.classList.toggle("hide", window.scrollY < 200);
}, 100);

window.addEventListener("scroll", onScrollEnd);
// #endregion

(async function () {
  trackEvent("OPEN-POPUP");

  if (!disableSmoothScrollSaver.get())
    disableSmoothScroll = enableSmoothScroll();
  initTracking();
  initSearch();
  initTooltip();
  initSettings();
  initScrollToTop();
  createTabs().then(restoreScroll);

  checkForUpdate();
})();
