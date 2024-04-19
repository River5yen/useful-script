import { runScriptInCurrentTab } from "../helpers/utils.js";

chrome.contextMenus.onClicked.addListener((info) => {
  console.log(info);
  if (info.menuItemId == "ufs-magnify-image") {
    /*
    {
      "editable": false,
      "frameId": 2491,
      "frameUrl": "https://www.deviantart.com/_nsfgfb/?realEstateId=166926a9-15ab-458d-b424-4385d5c9acde&theme=dark&biClientId=fdb7b474-671d-686c-7ebc-7027eecd49f0&biClientIdSigned=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJiaUNsaWVudElkIjoiZmRiN2I0NzQtNjcxZC02ODZjLTdlYmMtNzAyN2VlY2Q0OWYwIiwidHMiOjE3MTM0NjgyNTAsInVzZXJVdWlkIjoiZmRiN2I0NzQtNjcxZC02ODZjLTdlYmMtNzAyN2VlY2Q0OWYwIn0.z98X9tXSYMaUubtwGGG08NsikaoZ7iODsn_aWaeiGD0&newApi=2&platform=desktop",
      "linkUrl": "https://www.deviantart.com/join?referer=https%3A%2F%2Fwww.deviantart.com%2Fdreamup%3Fda_dealer_footer=1",
      "mediaType": "image",
      "menuItemId": "ufs-magnify-image",
      "pageUrl": "https://www.deviantart.com/kat-zaphire/art/Deep-in-the-forest-989494503",
      "srcUrl": "https://wixmp-70a14ff54af6225c7974eec7.wixmp.com/offers-assets/94f22a36-bb47-4836-8bce-fea45f844aa4.gif"
  } */
    runScriptInCurrentTab(
      (_data) => {
        if (typeof window.ufs_magnify_image_createPreview === "function") {
          window.ufs_magnify_image_createPreview(
            _data?.srcUrl,
            window.innerWidth / 2,
            window.innerHeight / 2
          );
        } else {
          alert(`Useful-script:

  Vui lòng bật chức năng 'Tự động hoá' > 'Phóng to mọi hình ảnh' trước.

  Please enable 'Automation' > 'Magnify any Image' first.
          `);
        }
      },
      [info]
    );
  }
});

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    title: "Magnify this image",
    contexts: ["image"],
    id: "ufs-magnify-image",
  });
});
