/*
 * OpenWebUI: menu item "Dokumentet" in the sidebar, for administrators only.
 *
 * OpenWebUI loads /static/loader.js on every page (an empty file by
 * default). This one adds, below "Hapësira e punës" (Workspace), an item
 * that opens the assistant's documents page (rag/admin_page.py) in a new
 * tab and signs the administrator in there with the OpenWebUI session, so no
 * second password is needed. Users who are not admins never see it (and the
 * documents page would refuse them anyway: it checks the role with OpenWebUI).
 *
 * It lives in the OpenWebUI repository (Bajram-1/Open-Web-UI) as
 * static/static/loader.js, so it is built into the OpenWebUI image; this copy
 * is the reference (see DOCUMENTS.md, "In the OpenWebUI menu").
 * The address of the documents page is DOCUMENTS_URL below.
 */
(function () {
  "use strict";

  // Address of the documents page, as the administrators' browsers reach it.
  var DOCUMENTS_URL = window.RAG_DOCUMENTS_URL || "http://192.168.88.196:8000/admin";
  var LABEL = "Dokumentet";
  var MARK = "data-rag-documents";
  var ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-4" aria-hidden="true">' +
    '<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/></svg>';

  var documentsOrigin;
  try {
    documentsOrigin = new URL(DOCUMENTS_URL, window.location.href).origin;
  } catch (e) {
    return;
  }

  // ---------------------------------------------------------------------
  // The signed-in OpenWebUI user
  // ---------------------------------------------------------------------

  function session() {
    var headers = {};
    try {
      var stored = window.localStorage.getItem("token");
      if (stored) headers.Authorization = "Bearer " + stored;
    } catch (e) {}
    return fetch("/api/v1/auths/", { credentials: "include", headers: headers })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .catch(function () {
        return null;
      });
  }

  // ---------------------------------------------------------------------
  // Opening the page and handing over the session
  // ---------------------------------------------------------------------

  function openDocuments(event) {
    event.preventDefault();
    event.stopPropagation();
    var page = window.open(DOCUMENTS_URL, "rag-documents");
    if (!page) {
      window.location.href = DOCUMENTS_URL; // pop-ups blocked: sign in there
      return;
    }
    var answered = false;
    function onMessage(message) {
      // Only the page just opened, from the documents address, gets the session.
      if (message.source !== page || message.origin !== documentsOrigin) return;
      if (!message.data || message.data.type !== "rag-admin-ready" || answered) return;
      answered = true;
      window.removeEventListener("message", onMessage);
      session().then(function (user) {
        if (user && user.role === "admin" && user.token) {
          page.postMessage({ type: "rag-admin-session", token: user.token }, documentsOrigin);
        }
      });
    }
    window.addEventListener("message", onMessage);
    setTimeout(function () {
      window.removeEventListener("message", onMessage);
    }, 60000);
  }

  // ---------------------------------------------------------------------
  // The menu item: a copy of "Workspace", placed right after it
  // ---------------------------------------------------------------------

  // Styles a theme gives "Workspace" through its id (not copied) are taken
  // from the original as shown, so the item looks the same.
  function sameLook(original, link) {
    try {
      var from = window.getComputedStyle(original);
      ["padding", "gap", "minHeight", "borderRadius", "fontSize"].forEach(function (name) {
        if (from[name]) link.style[name] = from[name];
      });
      var originalIcon = original.querySelector("svg");
      var icon = link.querySelector("svg");
      if (originalIcon && icon) {
        var size = window.getComputedStyle(originalIcon);
        icon.style.width = size.width;
        icon.style.height = size.height;
      }
    } catch (e) {}
  }

  function addMenuItems() {
    var links = document.querySelectorAll('a[href="/workspace"]');
    for (var i = 0; i < links.length; i++) {
      var original = links[i];
      var row = original.parentElement;
      if (!row || !row.parentElement) continue;
      if (row.nextElementSibling && row.nextElementSibling.hasAttribute(MARK)) continue;
      var copy = row.cloneNode(true);
      copy.setAttribute(MARK, "");
      copy.removeAttribute("data-id");
      var link = copy.querySelector("a") || copy;
      link.removeAttribute("id");
      link.setAttribute("href", DOCUMENTS_URL);
      link.setAttribute("aria-label", LABEL);
      link.setAttribute("title", LABEL);
      // Never shown as the active page.
      link.className = link.className
        .replace(/bg-black\/\[[^\]]*\]/g, "")
        .replace(/dark:bg-white\/\[[^\]]*\]/g, "");
      if (link.className.indexOf("hover:bg-gray-100") < 0) link.className += " hover:bg-gray-100 dark:hover:bg-gray-900";
      var icon = link.querySelector("svg");
      if (icon) icon.outerHTML = ICON;
      sameLook(original, link);
      var texts = link.querySelectorAll("div");
      for (var j = texts.length - 1; j >= 0; j--) {
        if (texts[j].children.length === 0 && texts[j].textContent.trim()) {
          texts[j].textContent = LABEL;
          break;
        }
      }
      link.addEventListener("click", openDocuments);
      row.parentElement.insertBefore(copy, row.nextSibling);
    }
  }

  // The role is asked when a sidebar is shown (also after signing in, which
  // does not reload the page) and again after a minute.
  var role = null;
  var checkedAt = 0;
  var checking = false;

  function update() {
    var missing = false;
    var links = document.querySelectorAll('a[href="/workspace"]');
    for (var i = 0; i < links.length; i++) {
      var row = links[i].parentElement;
      if (row && !(row.nextElementSibling && row.nextElementSibling.hasAttribute(MARK))) missing = true;
    }
    if (!missing) return;
    if (role === "admin" && Date.now() - checkedAt < 60000) {
      addMenuItems();
      return;
    }
    // Not an admin (or not signed in): asked again at most once a minute.
    if (checking || Date.now() - checkedAt < (checkedAt && role ? 60000 : 5000)) return;
    checking = true;
    session().then(function (user) {
      role = user && user.role;
      checkedAt = Date.now();
      checking = false;
      if (role === "admin") addMenuItems();
    });
  }

  function start() {
    update();
    var pending = false;
    new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () {
        pending = false;
        update();
      }, 250);
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
