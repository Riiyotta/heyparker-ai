// Copied unchanged from website-builder lib/clone-dom.js (the generator's own DOM -> JSX serialiser), so a breakpoint variant is
// converted by exactly the same code as the desktop pages. Runs INSIDE the page (page.evaluate).
// Runs INSIDE the page (page.evaluate), right after extractPage() tagged the sections. Self-contained — no imports.
// Serialises the live, rendered DOM to JSX for the React clone:
//   skeleton  : <body>'s content with every section replaced by a slot marker (wrappers, spacers and decorations kept,
//               so the page keeps its real structure and every CSS selector that depends on an ancestor still matches)
//   sections  : each section's own markup (one component per section type is assembled from these in lib/clone.mjs)
//   styles    : the stylesheets in force (linked hrefs + inline <style> text, CSS-in-JS rules read from the CSSOM)
//   html/body : their attributes (font variables, theme classes and body classes that the CSS depends on)
// Dropped: <script>, <noscript>, <template>, inline event handlers, and the builder's own data-ds-* markers. A <canvas>
// or animation-player element becomes a still image (captured by the caller from the data-ds-still marker).
export function exportClone() {
  const SLOT = (i) => `\u0001S${i}\u0001`;
  const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
  const DROP = new Set(["SCRIPT", "NOSCRIPT", "TEMPLATE", "LINK", "META", "BASE", "TITLE"]);
  const PLAYER = /^(lottie-player|dotlottie-player|rive-canvas|model-viewer|spline-viewer)$/i;
  const BOOL = new Set(["disabled", "checked", "hidden", "muted", "loop", "autoplay", "playsinline", "controls", "multiple", "required", "open", "novalidate", "allowfullscreen", "readonly", "inert", "reversed", "default", "async", "defer", "nomodule", "itemscope"]);
  const ATTR = {
    class: "className", for: "htmlFor", tabindex: "tabIndex", readonly: "readOnly", maxlength: "maxLength", minlength: "minLength",
    colspan: "colSpan", rowspan: "rowSpan", srcset: "srcSet", crossorigin: "crossOrigin", autocomplete: "autoComplete", autofocus: "autoFocus",
    autoplay: "autoPlay", playsinline: "playsInline", contenteditable: "contentEditable", spellcheck: "spellCheck", enterkeyhint: "enterKeyHint",
    inputmode: "inputMode", frameborder: "frameBorder", allowfullscreen: "allowFullScreen", datetime: "dateTime", enctype: "encType",
    novalidate: "noValidate", referrerpolicy: "referrerPolicy", usemap: "useMap", cellpadding: "cellPadding", cellspacing: "cellSpacing",
    accesskey: "accessKey", fetchpriority: "fetchPriority", itemprop: "itemProp", itemscope: "itemScope", itemtype: "itemType",
    "xlink:href": "xlinkHref", "xml:space": "xmlSpace", "xml:lang": "xmlLang", "xmlns:xlink": "xmlnsXlink", "accept-charset": "acceptCharset",
    imagesrcset: "imageSrcSet", imagesizes: "imageSizes", popovertarget: "popoverTarget", nomodule: "noModule", hreflang: "hrefLang",
    marginwidth: "marginWidth", marginheight: "marginHeight", srcdoc: "srcDoc", srclang: "srcLang", charset: "charSet", formaction: "formAction",
    value: "defaultValue", checked: "defaultChecked", muted: "muted",
  };
  const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const q = (v) => (/["&\\\n\r{}]/.test(v) ? `{${JSON.stringify(v)}}` : `"${v}"`);
  // style="" text -> JSX style object. Splits on ";" outside quotes and parentheses (url(data:…;base64,…) stays whole).
  const styleObj = (css) => {
    const decls = []; let depth = 0, quote = null, cur = "";
    for (const ch of css) {
      if (quote) { if (ch === quote) quote = null; cur += ch; continue; }
      if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
      if (ch === "(") depth++; else if (ch === ")") depth = Math.max(0, depth - 1);
      if (ch === ";" && !depth) { decls.push(cur); cur = ""; } else cur += ch;
    }
    decls.push(cur);
    const out = [];
    for (const d of decls) {
      const i = d.indexOf(":"); if (i < 0) continue;
      const prop = d.slice(0, i).trim(); let val = d.slice(i + 1).trim().replace(/\s*!important\s*$/i, "");
      if (!prop || !val) continue;
      const key = prop.startsWith("--") ? prop : prop.startsWith("-ms-") ? camel(prop.slice(1)) : prop.startsWith("-") ? camel(prop.slice(1)).replace(/^./, (c) => c.toUpperCase()) : camel(prop.toLowerCase());
      out.push(`${JSON.stringify(key)}: ${JSON.stringify(val)}`);
    }
    return out.length ? `{{ ${out.join(", ")} }}` : null;
  };
  let stillN = 0;
  const stills = []; // { i } — caller screenshots [data-ds-still=i]
  const attrsOf = (el, extra = []) => {
    const out = [];
    const svg = el instanceof SVGElement;
    // a custom element (<krida-vault>) gets display/position from its script (:defined rules, the constructor) — without
    // the script it would fall back to inline layout and its absolutely-positioned art would land elsewhere: pin both
    let pinned = "";
    if (el.tagName.includes("-") && !(el instanceof SVGElement)) {
      const cs = getComputedStyle(el), own = el.getAttribute("style") || "";
      if (!/(^|;)\s*display\s*:/.test(own)) pinned += `display:${cs.display};`;
      if (!/(^|;)\s*position\s*:/.test(own) && cs.position !== "static") pinned += `position:${cs.position};`;
      // its height may come from the script too (all children absolutely positioned): keep it as a minimum
      const h = el.getBoundingClientRect().height;
      if (h > 0 && !/(^|;)\s*(min-)?height\s*:/.test(own)) pinned += `min-height:${Math.round(h)}px;`;
      if (pinned && !el.hasAttribute("style")) { const s = styleObj(pinned); if (s) out.push(`style=${s}`); }
    }
    for (const a of Array.from(el.attributes)) {
      let n = a.name, v = a.value;
      if (/^on/i.test(n) || /^data-ds-/.test(n)) continue;
      if (n === "style") { const s = styleObj(pinned + v); if (s) out.push(`style=${s}`); continue; }
      if (el.tagName === "OPTION" && n === "selected") continue;
      if (el.tagName === "TEXTAREA" && n === "value") continue;
      const lower = n.toLowerCase();
      let name = ATTR[lower] || (/^(data|aria)-/.test(lower) ? lower : n.includes("-") && !/^(data|aria)-/.test(lower) ? camel(lower) : svg ? n : lower);
      if (name === "defaultValue" && !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) name = "value";
      if (name === "defaultChecked" && el.tagName !== "INPUT") name = "checked";
      if (!/^[A-Za-z_][\w-]*$/.test(name)) continue; // Vue @click, :class, x-on.click … are not valid JSX attribute names
      if (/^(key|ref|children|dangerouslySetInnerHTML)$/.test(name)) continue; // React-reserved props
      if (BOOL.has(lower) && (v === "" || v.toLowerCase() === lower)) { out.push(`${name}={true}`); continue; }
      out.push(`${name}=${q(v)}`);
    }
    return out.concat(extra);
  };
  const tagOf = (el) => (el.tagName === "DS-WRAP" ? "div" : el instanceof SVGElement ? el.tagName : el.tagName.toLowerCase());
  const serialize = (node, slots) => {
    if (node.nodeType === 3) { const t = node.textContent; return t ? (/^\s+$/.test(t) ? `{" "}` : `{${JSON.stringify(t)}}`) : ""; }
    if (node.nodeType !== 1) return "";
    const el = node;
    if (DROP.has(el.tagName)) return "";
    if (slots && el.hasAttribute("data-ds-idx")) return SLOT(el.getAttribute("data-ds-idx"));
    const extra = []; // (a <ds-wrap> already carries style="display:block" from extractPage, so it serialises as a plain block div)
    // a canvas / animation player has no reproducible markup: a still image of it as rendered, same box (so is a custom
    // element that renders into its own shadow DOM: that content is not in the markup at all)
    const shadowOnly = el.tagName.includes("-") && el.shadowRoot && el.shadowRoot.childElementCount > 0 && !el.children.length;
    if (el.tagName === "CANVAS" || PLAYER.test(el.tagName) || shadowOnly) {
      const b = el.getBoundingClientRect();
      const i = stillN++; el.setAttribute("data-ds-still", String(i)); stills.push({ i, w: Math.round(b.width), h: Math.round(b.height) });
      const keep = attrsOf(el).filter((x) => /^(className|style|id|aria-|role)/.test(x));
      return `<img ${keep.join(" ")} src="\u0001STILL${i}\u0001" alt="" width={${Math.round(b.width) || 1}} height={${Math.round(b.height) || 1}} />`;
    }
    // an embedded frame would be a runtime request to another site: keep its box, drop the frame
    if (el.tagName === "IFRAME" || el.tagName === "OBJECT" || el.tagName === "EMBED") {
      const b = el.getBoundingClientRect();
      const keep = attrsOf(el).filter((x) => /^(className|id)=/.test(x));
      return `<div ${keep.join(" ")} data-removed-embed=${q(el.tagName.toLowerCase())} style={{ "width": "${Math.round(b.width)}px", "height": "${Math.round(b.height)}px" }} />`;
    }
    const tag = tagOf(el);
    const attrs = attrsOf(el, extra);
    if (el.tagName === "STYLE") return `<style dangerouslySetInnerHTML={{ __html: ${JSON.stringify(el.textContent)} }} />`;
    if (el.tagName === "TEXTAREA") return `<textarea ${attrs.join(" ")} defaultValue={${JSON.stringify(el.value || el.textContent)}} />`;
    if (VOID.has(el.tagName.toLowerCase())) return `<${tag}${attrs.length ? " " + attrs.join(" ") : ""} />`;
    const kids = Array.from(el.childNodes).map((c) => serialize(c, slots)).join("");
    return `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>${kids}</${tag}>`;
  };
  const attrMap = (el) => { const o = {}; for (const a of Array.from(el.attributes)) if (!/^data-ds-|^on/i.test(a.name)) o[a.name] = a.value; return o; };

  const sections = Array.from(document.querySelectorAll("[data-ds-idx]")).map((el) => ({ idx: +el.getAttribute("data-ds-idx"), jsx: serialize(el, false) }));
  const skeleton = Array.from(document.body.childNodes).map((c) => serialize(c, true)).join("");
  const styles = [];
  for (const el of Array.from(document.querySelectorAll('link[rel~="stylesheet"][href], style'))) {
    if (el.closest("svg")) continue; // an <svg>'s own <style> stays inline with its markup
    if (el.tagName === "LINK") { if (!el.disabled) styles.push({ href: el.href, media: el.media || null }); continue; }
    if (document.body.contains(el)) continue; // a <style> in the body is serialised in place
    let text = el.textContent;
    if (!text.trim() && el.sheet) { try { text = Array.from(el.sheet.cssRules).map((r) => r.cssText).join("\n"); } catch (e) {} } // CSS-in-JS (insertRule)
    if (text.trim()) styles.push({ text, media: el.media || null });
  }
  return { skeleton, sections, styles, stills, html: attrMap(document.documentElement), body: attrMap(document.body), title: document.title };
}
