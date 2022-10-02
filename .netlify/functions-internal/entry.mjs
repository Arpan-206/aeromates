import * as adapter from '@astrojs/netlify/netlify-functions.js';
import { escape } from 'html-escaper';
/* empty css                           */import 'mime';
import 'cookie';
import 'kleur/colors';
import 'string-width';
import 'path-browserify';
import { compile } from 'path-to-regexp';

const ASTRO_VERSION = "1.4.2";
function createDeprecatedFetchContentFn() {
  return () => {
    throw new Error("Deprecated: Astro.fetchContent() has been replaced with Astro.glob().");
  };
}
function createAstroGlobFn() {
  const globHandler = (importMetaGlobResult, globValue) => {
    let allEntries = [...Object.values(importMetaGlobResult)];
    if (allEntries.length === 0) {
      throw new Error(`Astro.glob(${JSON.stringify(globValue())}) - no matches found.`);
    }
    return Promise.all(allEntries.map((fn) => fn()));
  };
  return globHandler;
}
function createAstro(filePathname, _site, projectRootStr) {
  const site = _site ? new URL(_site) : void 0;
  const referenceURL = new URL(filePathname, `http://localhost`);
  const projectRoot = new URL(projectRootStr);
  return {
    site,
    generator: `Astro v${ASTRO_VERSION}`,
    fetchContent: createDeprecatedFetchContentFn(),
    glob: createAstroGlobFn(),
    resolve(...segments) {
      let resolved = segments.reduce((u, segment) => new URL(segment, u), referenceURL).pathname;
      if (resolved.startsWith(projectRoot.pathname)) {
        resolved = "/" + resolved.slice(projectRoot.pathname.length);
      }
      return resolved;
    }
  };
}

const escapeHTML = escape;
class HTMLString extends String {
  get [Symbol.toStringTag]() {
    return "HTMLString";
  }
}
const markHTMLString = (value) => {
  if (value instanceof HTMLString) {
    return value;
  }
  if (typeof value === "string") {
    return new HTMLString(value);
  }
  return value;
};

class Metadata {
  constructor(filePathname, opts) {
    this.modules = opts.modules;
    this.hoisted = opts.hoisted;
    this.hydratedComponents = opts.hydratedComponents;
    this.clientOnlyComponents = opts.clientOnlyComponents;
    this.hydrationDirectives = opts.hydrationDirectives;
    this.mockURL = new URL(filePathname, "http://example.com");
    this.metadataCache = /* @__PURE__ */ new Map();
  }
  resolvePath(specifier) {
    if (specifier.startsWith(".")) {
      const resolved = new URL(specifier, this.mockURL).pathname;
      if (resolved.startsWith("/@fs") && resolved.endsWith(".jsx")) {
        return resolved.slice(0, resolved.length - 4);
      }
      return resolved;
    }
    return specifier;
  }
  getPath(Component) {
    const metadata = this.getComponentMetadata(Component);
    return (metadata == null ? void 0 : metadata.componentUrl) || null;
  }
  getExport(Component) {
    const metadata = this.getComponentMetadata(Component);
    return (metadata == null ? void 0 : metadata.componentExport) || null;
  }
  getComponentMetadata(Component) {
    if (this.metadataCache.has(Component)) {
      return this.metadataCache.get(Component);
    }
    const metadata = this.findComponentMetadata(Component);
    this.metadataCache.set(Component, metadata);
    return metadata;
  }
  findComponentMetadata(Component) {
    const isCustomElement = typeof Component === "string";
    for (const { module, specifier } of this.modules) {
      const id = this.resolvePath(specifier);
      for (const [key, value] of Object.entries(module)) {
        if (isCustomElement) {
          if (key === "tagName" && Component === value) {
            return {
              componentExport: key,
              componentUrl: id
            };
          }
        } else if (Component === value) {
          return {
            componentExport: key,
            componentUrl: id
          };
        }
      }
    }
    return null;
  }
}
function createMetadata(filePathname, options) {
  return new Metadata(filePathname, options);
}

const PROP_TYPE = {
  Value: 0,
  JSON: 1,
  RegExp: 2,
  Date: 3,
  Map: 4,
  Set: 5,
  BigInt: 6,
  URL: 7,
  Uint8Array: 8,
  Uint16Array: 9,
  Uint32Array: 10
};
function serializeArray(value, metadata = {}, parents = /* @__PURE__ */ new WeakSet()) {
  if (parents.has(value)) {
    throw new Error(`Cyclic reference detected while serializing props for <${metadata.displayName} client:${metadata.hydrate}>!

Cyclic references cannot be safely serialized for client-side usage. Please remove the cyclic reference.`);
  }
  parents.add(value);
  const serialized = value.map((v) => {
    return convertToSerializedForm(v, metadata, parents);
  });
  parents.delete(value);
  return serialized;
}
function serializeObject(value, metadata = {}, parents = /* @__PURE__ */ new WeakSet()) {
  if (parents.has(value)) {
    throw new Error(`Cyclic reference detected while serializing props for <${metadata.displayName} client:${metadata.hydrate}>!

Cyclic references cannot be safely serialized for client-side usage. Please remove the cyclic reference.`);
  }
  parents.add(value);
  const serialized = Object.fromEntries(
    Object.entries(value).map(([k, v]) => {
      return [k, convertToSerializedForm(v, metadata, parents)];
    })
  );
  parents.delete(value);
  return serialized;
}
function convertToSerializedForm(value, metadata = {}, parents = /* @__PURE__ */ new WeakSet()) {
  const tag = Object.prototype.toString.call(value);
  switch (tag) {
    case "[object Date]": {
      return [PROP_TYPE.Date, value.toISOString()];
    }
    case "[object RegExp]": {
      return [PROP_TYPE.RegExp, value.source];
    }
    case "[object Map]": {
      return [
        PROP_TYPE.Map,
        JSON.stringify(serializeArray(Array.from(value), metadata, parents))
      ];
    }
    case "[object Set]": {
      return [
        PROP_TYPE.Set,
        JSON.stringify(serializeArray(Array.from(value), metadata, parents))
      ];
    }
    case "[object BigInt]": {
      return [PROP_TYPE.BigInt, value.toString()];
    }
    case "[object URL]": {
      return [PROP_TYPE.URL, value.toString()];
    }
    case "[object Array]": {
      return [PROP_TYPE.JSON, JSON.stringify(serializeArray(value, metadata, parents))];
    }
    case "[object Uint8Array]": {
      return [PROP_TYPE.Uint8Array, JSON.stringify(Array.from(value))];
    }
    case "[object Uint16Array]": {
      return [PROP_TYPE.Uint16Array, JSON.stringify(Array.from(value))];
    }
    case "[object Uint32Array]": {
      return [PROP_TYPE.Uint32Array, JSON.stringify(Array.from(value))];
    }
    default: {
      if (value !== null && typeof value === "object") {
        return [PROP_TYPE.Value, serializeObject(value, metadata, parents)];
      } else {
        return [PROP_TYPE.Value, value];
      }
    }
  }
}
function serializeProps(props, metadata) {
  const serialized = JSON.stringify(serializeObject(props, metadata));
  return serialized;
}

function serializeListValue(value) {
  const hash = {};
  push(value);
  return Object.keys(hash).join(" ");
  function push(item) {
    if (item && typeof item.forEach === "function")
      item.forEach(push);
    else if (item === Object(item))
      Object.keys(item).forEach((name) => {
        if (item[name])
          push(name);
      });
    else {
      item = item === false || item == null ? "" : String(item).trim();
      if (item) {
        item.split(/\s+/).forEach((name) => {
          hash[name] = true;
        });
      }
    }
  }
}

const HydrationDirectivesRaw = ["load", "idle", "media", "visible", "only"];
const HydrationDirectives = new Set(HydrationDirectivesRaw);
const HydrationDirectiveProps = new Set(HydrationDirectivesRaw.map((n) => `client:${n}`));
function extractDirectives(inputProps) {
  let extracted = {
    isPage: false,
    hydration: null,
    props: {}
  };
  for (const [key, value] of Object.entries(inputProps)) {
    if (key.startsWith("server:")) {
      if (key === "server:root") {
        extracted.isPage = true;
      }
    }
    if (key.startsWith("client:")) {
      if (!extracted.hydration) {
        extracted.hydration = {
          directive: "",
          value: "",
          componentUrl: "",
          componentExport: { value: "" }
        };
      }
      switch (key) {
        case "client:component-path": {
          extracted.hydration.componentUrl = value;
          break;
        }
        case "client:component-export": {
          extracted.hydration.componentExport.value = value;
          break;
        }
        case "client:component-hydration": {
          break;
        }
        case "client:display-name": {
          break;
        }
        default: {
          extracted.hydration.directive = key.split(":")[1];
          extracted.hydration.value = value;
          if (!HydrationDirectives.has(extracted.hydration.directive)) {
            throw new Error(
              `Error: invalid hydration directive "${key}". Supported hydration methods: ${Array.from(
                HydrationDirectiveProps
              ).join(", ")}`
            );
          }
          if (extracted.hydration.directive === "media" && typeof extracted.hydration.value !== "string") {
            throw new Error(
              'Error: Media query must be provided for "client:media", similar to client:media="(max-width: 600px)"'
            );
          }
          break;
        }
      }
    } else if (key === "class:list") {
      if (value) {
        extracted.props[key.slice(0, -5)] = serializeListValue(value);
      }
    } else {
      extracted.props[key] = value;
    }
  }
  return extracted;
}
async function generateHydrateScript(scriptOptions, metadata) {
  const { renderer, result, astroId, props, attrs } = scriptOptions;
  const { hydrate, componentUrl, componentExport } = metadata;
  if (!componentExport.value) {
    throw new Error(
      `Unable to resolve a valid export for "${metadata.displayName}"! Please open an issue at https://astro.build/issues!`
    );
  }
  const island = {
    children: "",
    props: {
      uid: astroId
    }
  };
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      island.props[key] = value;
    }
  }
  island.props["component-url"] = await result.resolve(decodeURI(componentUrl));
  if (renderer.clientEntrypoint) {
    island.props["component-export"] = componentExport.value;
    island.props["renderer-url"] = await result.resolve(decodeURI(renderer.clientEntrypoint));
    island.props["props"] = escapeHTML(serializeProps(props, metadata));
  }
  island.props["ssr"] = "";
  island.props["client"] = hydrate;
  let beforeHydrationUrl = await result.resolve("astro:scripts/before-hydration.js");
  if (beforeHydrationUrl.length) {
    island.props["before-hydration-url"] = beforeHydrationUrl;
  }
  island.props["opts"] = escapeHTML(
    JSON.stringify({
      name: metadata.displayName,
      value: metadata.hydrateArgs || ""
    })
  );
  return island;
}

class SlotString extends HTMLString {
  constructor(content, instructions) {
    super(content);
    this.instructions = instructions;
  }
}
async function renderSlot(_result, slotted, fallback) {
  if (slotted) {
    let iterator = renderChild(slotted);
    let content = "";
    let instructions = null;
    for await (const chunk of iterator) {
      if (chunk.type === "directive") {
        if (instructions === null) {
          instructions = [];
        }
        instructions.push(chunk);
      } else {
        content += chunk;
      }
    }
    return markHTMLString(new SlotString(content, instructions));
  }
  return fallback;
}
async function renderSlots(result, slots = {}) {
  let slotInstructions = null;
  let children = {};
  if (slots) {
    await Promise.all(
      Object.entries(slots).map(
        ([key, value]) => renderSlot(result, value).then((output) => {
          if (output.instructions) {
            if (slotInstructions === null) {
              slotInstructions = [];
            }
            slotInstructions.push(...output.instructions);
          }
          children[key] = output;
        })
      )
    );
  }
  return { slotInstructions, children };
}

async function* renderChild(child) {
  child = await child;
  if (child instanceof SlotString) {
    if (child.instructions) {
      yield* child.instructions;
    }
    yield child;
  } else if (child instanceof HTMLString) {
    yield child;
  } else if (Array.isArray(child)) {
    for (const value of child) {
      yield markHTMLString(await renderChild(value));
    }
  } else if (typeof child === "function") {
    yield* renderChild(child());
  } else if (typeof child === "string") {
    yield markHTMLString(escapeHTML(child));
  } else if (!child && child !== 0) ; else if (child instanceof AstroComponent || Object.prototype.toString.call(child) === "[object AstroComponent]") {
    yield* renderAstroComponent(child);
  } else if (ArrayBuffer.isView(child)) {
    yield child;
  } else if (typeof child === "object" && (Symbol.asyncIterator in child || Symbol.iterator in child)) {
    yield* child;
  } else {
    yield child;
  }
}

var idle_prebuilt_default = `(self.Astro=self.Astro||{}).idle=t=>{const e=async()=>{await(await t())()};"requestIdleCallback"in window?window.requestIdleCallback(e):setTimeout(e,200)},window.dispatchEvent(new Event("astro:idle"));`;

var load_prebuilt_default = `(self.Astro=self.Astro||{}).load=a=>{(async()=>await(await a())())()},window.dispatchEvent(new Event("astro:load"));`;

var media_prebuilt_default = `(self.Astro=self.Astro||{}).media=(s,a)=>{const t=async()=>{await(await s())()};if(a.value){const e=matchMedia(a.value);e.matches?t():e.addEventListener("change",t,{once:!0})}},window.dispatchEvent(new Event("astro:media"));`;

var only_prebuilt_default = `(self.Astro=self.Astro||{}).only=t=>{(async()=>await(await t())())()},window.dispatchEvent(new Event("astro:only"));`;

var visible_prebuilt_default = `(self.Astro=self.Astro||{}).visible=(s,c,n)=>{const r=async()=>{await(await s())()};let i=new IntersectionObserver(e=>{for(const t of e)if(!!t.isIntersecting){i.disconnect(),r();break}});for(let e=0;e<n.children.length;e++){const t=n.children[e];i.observe(t)}},window.dispatchEvent(new Event("astro:visible"));`;

var astro_island_prebuilt_default = `var l;{const c={0:t=>t,1:t=>JSON.parse(t,o),2:t=>new RegExp(t),3:t=>new Date(t),4:t=>new Map(JSON.parse(t,o)),5:t=>new Set(JSON.parse(t,o)),6:t=>BigInt(t),7:t=>new URL(t),8:t=>new Uint8Array(JSON.parse(t)),9:t=>new Uint16Array(JSON.parse(t)),10:t=>new Uint32Array(JSON.parse(t))},o=(t,s)=>{if(t===""||!Array.isArray(s))return s;const[e,n]=s;return e in c?c[e](n):void 0};customElements.get("astro-island")||customElements.define("astro-island",(l=class extends HTMLElement{constructor(){super(...arguments);this.hydrate=()=>{if(!this.hydrator||this.parentElement&&this.parentElement.closest("astro-island[ssr]"))return;const s=this.querySelectorAll("astro-slot"),e={},n=this.querySelectorAll("template[data-astro-template]");for(const r of n){const i=r.closest(this.tagName);!i||!i.isSameNode(this)||(e[r.getAttribute("data-astro-template")||"default"]=r.innerHTML,r.remove())}for(const r of s){const i=r.closest(this.tagName);!i||!i.isSameNode(this)||(e[r.getAttribute("name")||"default"]=r.innerHTML)}const a=this.hasAttribute("props")?JSON.parse(this.getAttribute("props"),o):{};this.hydrator(this)(this.Component,a,e,{client:this.getAttribute("client")}),this.removeAttribute("ssr"),window.removeEventListener("astro:hydrate",this.hydrate),window.dispatchEvent(new CustomEvent("astro:hydrate"))}}connectedCallback(){!this.hasAttribute("await-children")||this.firstChild?this.childrenConnectedCallback():new MutationObserver((s,e)=>{e.disconnect(),this.childrenConnectedCallback()}).observe(this,{childList:!0})}async childrenConnectedCallback(){window.addEventListener("astro:hydrate",this.hydrate);let s=this.getAttribute("before-hydration-url");s&&await import(s),this.start()}start(){const s=JSON.parse(this.getAttribute("opts")),e=this.getAttribute("client");if(Astro[e]===void 0){window.addEventListener(\`astro:\${e}\`,()=>this.start(),{once:!0});return}Astro[e](async()=>{const n=this.getAttribute("renderer-url"),[a,{default:r}]=await Promise.all([import(this.getAttribute("component-url")),n?import(n):()=>()=>{}]),i=this.getAttribute("component-export")||"default";if(!i.includes("."))this.Component=a[i];else{this.Component=a;for(const d of i.split("."))this.Component=this.Component[d]}return this.hydrator=r,this.hydrate},s,this)}attributeChangedCallback(){this.hydrator&&this.hydrate()}},l.observedAttributes=["props"],l))}`;

function determineIfNeedsHydrationScript(result) {
  if (result._metadata.hasHydrationScript) {
    return false;
  }
  return result._metadata.hasHydrationScript = true;
}
const hydrationScripts = {
  idle: idle_prebuilt_default,
  load: load_prebuilt_default,
  only: only_prebuilt_default,
  media: media_prebuilt_default,
  visible: visible_prebuilt_default
};
function determinesIfNeedsDirectiveScript(result, directive) {
  if (result._metadata.hasDirectives.has(directive)) {
    return false;
  }
  result._metadata.hasDirectives.add(directive);
  return true;
}
function getDirectiveScriptText(directive) {
  if (!(directive in hydrationScripts)) {
    throw new Error(`Unknown directive: ${directive}`);
  }
  const directiveScriptText = hydrationScripts[directive];
  return directiveScriptText;
}
function getPrescripts(type, directive) {
  switch (type) {
    case "both":
      return `<style>astro-island,astro-slot{display:contents}</style><script>${getDirectiveScriptText(directive) + astro_island_prebuilt_default}<\/script>`;
    case "directive":
      return `<script>${getDirectiveScriptText(directive)}<\/script>`;
  }
  return "";
}

const Fragment = Symbol.for("astro:fragment");
const Renderer = Symbol.for("astro:renderer");
const encoder = new TextEncoder();
const decoder = new TextDecoder();
function stringifyChunk(result, chunk) {
  switch (chunk.type) {
    case "directive": {
      const { hydration } = chunk;
      let needsHydrationScript = hydration && determineIfNeedsHydrationScript(result);
      let needsDirectiveScript = hydration && determinesIfNeedsDirectiveScript(result, hydration.directive);
      let prescriptType = needsHydrationScript ? "both" : needsDirectiveScript ? "directive" : null;
      if (prescriptType) {
        let prescripts = getPrescripts(prescriptType, hydration.directive);
        return markHTMLString(prescripts);
      } else {
        return "";
      }
    }
    default: {
      return chunk.toString();
    }
  }
}
class HTMLParts {
  constructor() {
    this.parts = [];
  }
  append(part, result) {
    if (ArrayBuffer.isView(part)) {
      this.parts.push(part);
    } else {
      this.parts.push(stringifyChunk(result, part));
    }
  }
  toString() {
    let html = "";
    for (const part of this.parts) {
      if (ArrayBuffer.isView(part)) {
        html += decoder.decode(part);
      } else {
        html += part;
      }
    }
    return html;
  }
  toArrayBuffer() {
    this.parts.forEach((part, i) => {
      if (!ArrayBuffer.isView(part)) {
        this.parts[i] = encoder.encode(String(part));
      }
    });
    return concatUint8Arrays(this.parts);
  }
}
function concatUint8Arrays(arrays) {
  let len = 0;
  arrays.forEach((arr) => len += arr.length);
  let merged = new Uint8Array(len);
  let offset = 0;
  arrays.forEach((arr) => {
    merged.set(arr, offset);
    offset += arr.length;
  });
  return merged;
}

function validateComponentProps(props, displayName) {
  var _a;
  if (((_a = (Object.assign({"BASE_URL":"/","MODE":"production","DEV":false,"PROD":true},{_:process.env._,}))) == null ? void 0 : _a.DEV) && props != null) {
    for (const prop of Object.keys(props)) {
      if (HydrationDirectiveProps.has(prop)) {
        console.warn(
          `You are attempting to render <${displayName} ${prop} />, but ${displayName} is an Astro component. Astro components do not render in the client and should not have a hydration directive. Please use a framework component for client rendering.`
        );
      }
    }
  }
}
class AstroComponent {
  constructor(htmlParts, expressions) {
    this.htmlParts = htmlParts;
    this.expressions = expressions;
  }
  get [Symbol.toStringTag]() {
    return "AstroComponent";
  }
  async *[Symbol.asyncIterator]() {
    const { htmlParts, expressions } = this;
    for (let i = 0; i < htmlParts.length; i++) {
      const html = htmlParts[i];
      const expression = expressions[i];
      yield markHTMLString(html);
      yield* renderChild(expression);
    }
  }
}
function isAstroComponent(obj) {
  return typeof obj === "object" && Object.prototype.toString.call(obj) === "[object AstroComponent]";
}
function isAstroComponentFactory(obj) {
  return obj == null ? false : !!obj.isAstroComponentFactory;
}
async function* renderAstroComponent(component) {
  for await (const value of component) {
    if (value || value === 0) {
      for await (const chunk of renderChild(value)) {
        switch (chunk.type) {
          case "directive": {
            yield chunk;
            break;
          }
          default: {
            yield markHTMLString(chunk);
            break;
          }
        }
      }
    }
  }
}
async function renderToString(result, componentFactory, props, children) {
  const Component = await componentFactory(result, props, children);
  if (!isAstroComponent(Component)) {
    const response = Component;
    throw response;
  }
  let parts = new HTMLParts();
  for await (const chunk of renderAstroComponent(Component)) {
    parts.append(chunk, result);
  }
  return parts.toString();
}
async function renderToIterable(result, componentFactory, displayName, props, children) {
  validateComponentProps(props, displayName);
  const Component = await componentFactory(result, props, children);
  if (!isAstroComponent(Component)) {
    console.warn(
      `Returning a Response is only supported inside of page components. Consider refactoring this logic into something like a function that can be used in the page.`
    );
    const response = Component;
    throw response;
  }
  return renderAstroComponent(Component);
}
async function renderTemplate(htmlParts, ...expressions) {
  return new AstroComponent(htmlParts, expressions);
}

/**
 * shortdash - https://github.com/bibig/node-shorthash
 *
 * @license
 *
 * (The MIT License)
 *
 * Copyright (c) 2013 Bibig <bibig@me.com>
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
const dictionary = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXY";
const binary = dictionary.length;
function bitwise(str) {
  let hash = 0;
  if (str.length === 0)
    return hash;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    hash = (hash << 5) - hash + ch;
    hash = hash & hash;
  }
  return hash;
}
function shorthash(text) {
  let num;
  let result = "";
  let integer = bitwise(text);
  const sign = integer < 0 ? "Z" : "";
  integer = Math.abs(integer);
  while (integer >= binary) {
    num = integer % binary;
    integer = Math.floor(integer / binary);
    result = dictionary[num] + result;
  }
  if (integer > 0) {
    result = dictionary[integer] + result;
  }
  return sign + result;
}

const voidElementNames = /^(area|base|br|col|command|embed|hr|img|input|keygen|link|meta|param|source|track|wbr)$/i;
const htmlBooleanAttributes = /^(allowfullscreen|async|autofocus|autoplay|controls|default|defer|disabled|disablepictureinpicture|disableremoteplayback|formnovalidate|hidden|loop|nomodule|novalidate|open|playsinline|readonly|required|reversed|scoped|seamless|itemscope)$/i;
const htmlEnumAttributes = /^(contenteditable|draggable|spellcheck|value)$/i;
const svgEnumAttributes = /^(autoReverse|externalResourcesRequired|focusable|preserveAlpha)$/i;
const STATIC_DIRECTIVES = /* @__PURE__ */ new Set(["set:html", "set:text"]);
const toIdent = (k) => k.trim().replace(/(?:(?!^)\b\w|\s+|[^\w]+)/g, (match, index) => {
  if (/[^\w]|\s/.test(match))
    return "";
  return index === 0 ? match : match.toUpperCase();
});
const toAttributeString = (value, shouldEscape = true) => shouldEscape ? String(value).replace(/&/g, "&#38;").replace(/"/g, "&#34;") : value;
const kebab = (k) => k.toLowerCase() === k ? k : k.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
const toStyleString = (obj) => Object.entries(obj).map(([k, v]) => `${kebab(k)}:${v}`).join(";");
function defineScriptVars(vars) {
  let output = "";
  for (const [key, value] of Object.entries(vars)) {
    output += `const ${toIdent(key)} = ${JSON.stringify(value)};
`;
  }
  return markHTMLString(output);
}
function formatList(values) {
  if (values.length === 1) {
    return values[0];
  }
  return `${values.slice(0, -1).join(", ")} or ${values[values.length - 1]}`;
}
function addAttribute(value, key, shouldEscape = true) {
  if (value == null) {
    return "";
  }
  if (value === false) {
    if (htmlEnumAttributes.test(key) || svgEnumAttributes.test(key)) {
      return markHTMLString(` ${key}="false"`);
    }
    return "";
  }
  if (STATIC_DIRECTIVES.has(key)) {
    console.warn(`[astro] The "${key}" directive cannot be applied dynamically at runtime. It will not be rendered as an attribute.

Make sure to use the static attribute syntax (\`${key}={value}\`) instead of the dynamic spread syntax (\`{...{ "${key}": value }}\`).`);
    return "";
  }
  if (key === "class:list") {
    const listValue = toAttributeString(serializeListValue(value));
    if (listValue === "") {
      return "";
    }
    return markHTMLString(` ${key.slice(0, -5)}="${listValue}"`);
  }
  if (key === "style" && !(value instanceof HTMLString) && typeof value === "object") {
    return markHTMLString(` ${key}="${toStyleString(value)}"`);
  }
  if (key === "className") {
    return markHTMLString(` class="${toAttributeString(value, shouldEscape)}"`);
  }
  if (value === true && (key.startsWith("data-") || htmlBooleanAttributes.test(key))) {
    return markHTMLString(` ${key}`);
  } else {
    return markHTMLString(` ${key}="${toAttributeString(value, shouldEscape)}"`);
  }
}
function internalSpreadAttributes(values, shouldEscape = true) {
  let output = "";
  for (const [key, value] of Object.entries(values)) {
    output += addAttribute(value, key, shouldEscape);
  }
  return markHTMLString(output);
}
function renderElement$1(name, { props: _props, children = "" }, shouldEscape = true) {
  const { lang: _, "data-astro-id": astroId, "define:vars": defineVars, ...props } = _props;
  if (defineVars) {
    if (name === "style") {
      delete props["is:global"];
      delete props["is:scoped"];
    }
    if (name === "script") {
      delete props.hoist;
      children = defineScriptVars(defineVars) + "\n" + children;
    }
  }
  if ((children == null || children == "") && voidElementNames.test(name)) {
    return `<${name}${internalSpreadAttributes(props, shouldEscape)} />`;
  }
  return `<${name}${internalSpreadAttributes(props, shouldEscape)}>${children}</${name}>`;
}

function componentIsHTMLElement(Component) {
  return typeof HTMLElement !== "undefined" && HTMLElement.isPrototypeOf(Component);
}
async function renderHTMLElement(result, constructor, props, slots) {
  const name = getHTMLElementName(constructor);
  let attrHTML = "";
  for (const attr in props) {
    attrHTML += ` ${attr}="${toAttributeString(await props[attr])}"`;
  }
  return markHTMLString(
    `<${name}${attrHTML}>${await renderSlot(result, slots == null ? void 0 : slots.default)}</${name}>`
  );
}
function getHTMLElementName(constructor) {
  const definedName = customElements.getName(constructor);
  if (definedName)
    return definedName;
  const assignedName = constructor.name.replace(/^HTML|Element$/g, "").replace(/[A-Z]/g, "-$&").toLowerCase().replace(/^-/, "html-");
  return assignedName;
}

const rendererAliases = /* @__PURE__ */ new Map([["solid", "solid-js"]]);
function guessRenderers(componentUrl) {
  const extname = componentUrl == null ? void 0 : componentUrl.split(".").pop();
  switch (extname) {
    case "svelte":
      return ["@astrojs/svelte"];
    case "vue":
      return ["@astrojs/vue"];
    case "jsx":
    case "tsx":
      return ["@astrojs/react", "@astrojs/preact", "@astrojs/vue (jsx)"];
    default:
      return ["@astrojs/react", "@astrojs/preact", "@astrojs/vue", "@astrojs/svelte"];
  }
}
function getComponentType(Component) {
  if (Component === Fragment) {
    return "fragment";
  }
  if (Component && typeof Component === "object" && Component["astro:html"]) {
    return "html";
  }
  if (isAstroComponentFactory(Component)) {
    return "astro-factory";
  }
  return "unknown";
}
async function renderComponent(result, displayName, Component, _props, slots = {}) {
  var _a;
  Component = await Component;
  switch (getComponentType(Component)) {
    case "fragment": {
      const children2 = await renderSlot(result, slots == null ? void 0 : slots.default);
      if (children2 == null) {
        return children2;
      }
      return markHTMLString(children2);
    }
    case "html": {
      const { slotInstructions: slotInstructions2, children: children2 } = await renderSlots(result, slots);
      const html2 = Component.render({ slots: children2 });
      const hydrationHtml = slotInstructions2 ? slotInstructions2.map((instr) => stringifyChunk(result, instr)).join("") : "";
      return markHTMLString(hydrationHtml + html2);
    }
    case "astro-factory": {
      async function* renderAstroComponentInline() {
        let iterable = await renderToIterable(result, Component, displayName, _props, slots);
        yield* iterable;
      }
      return renderAstroComponentInline();
    }
  }
  if (!Component && !_props["client:only"]) {
    throw new Error(
      `Unable to render ${displayName} because it is ${Component}!
Did you forget to import the component or is it possible there is a typo?`
    );
  }
  const { renderers } = result._metadata;
  const metadata = { displayName };
  const { hydration, isPage, props } = extractDirectives(_props);
  let html = "";
  let attrs = void 0;
  if (hydration) {
    metadata.hydrate = hydration.directive;
    metadata.hydrateArgs = hydration.value;
    metadata.componentExport = hydration.componentExport;
    metadata.componentUrl = hydration.componentUrl;
  }
  const probableRendererNames = guessRenderers(metadata.componentUrl);
  if (Array.isArray(renderers) && renderers.length === 0 && typeof Component !== "string" && !componentIsHTMLElement(Component)) {
    const message = `Unable to render ${metadata.displayName}!

There are no \`integrations\` set in your \`astro.config.mjs\` file.
Did you mean to add ${formatList(probableRendererNames.map((r) => "`" + r + "`"))}?`;
    throw new Error(message);
  }
  const { children, slotInstructions } = await renderSlots(result, slots);
  let renderer;
  if (metadata.hydrate !== "only") {
    if (Component && Component[Renderer]) {
      const rendererName = Component[Renderer];
      renderer = renderers.find(({ name }) => name === rendererName);
    }
    if (!renderer) {
      let error;
      for (const r of renderers) {
        try {
          if (await r.ssr.check.call({ result }, Component, props, children)) {
            renderer = r;
            break;
          }
        } catch (e) {
          error ?? (error = e);
        }
      }
      if (!renderer && error) {
        throw error;
      }
    }
    if (!renderer && typeof HTMLElement === "function" && componentIsHTMLElement(Component)) {
      const output = renderHTMLElement(result, Component, _props, slots);
      return output;
    }
  } else {
    if (metadata.hydrateArgs) {
      const passedName = metadata.hydrateArgs;
      const rendererName = rendererAliases.has(passedName) ? rendererAliases.get(passedName) : passedName;
      renderer = renderers.find(
        ({ name }) => name === `@astrojs/${rendererName}` || name === rendererName
      );
    }
    if (!renderer && renderers.length === 1) {
      renderer = renderers[0];
    }
    if (!renderer) {
      const extname = (_a = metadata.componentUrl) == null ? void 0 : _a.split(".").pop();
      renderer = renderers.filter(
        ({ name }) => name === `@astrojs/${extname}` || name === extname
      )[0];
    }
  }
  if (!renderer) {
    if (metadata.hydrate === "only") {
      throw new Error(`Unable to render ${metadata.displayName}!

Using the \`client:only\` hydration strategy, Astro needs a hint to use the correct renderer.
Did you mean to pass <${metadata.displayName} client:only="${probableRendererNames.map((r) => r.replace("@astrojs/", "")).join("|")}" />
`);
    } else if (typeof Component !== "string") {
      const matchingRenderers = renderers.filter((r) => probableRendererNames.includes(r.name));
      const plural = renderers.length > 1;
      if (matchingRenderers.length === 0) {
        throw new Error(`Unable to render ${metadata.displayName}!

There ${plural ? "are" : "is"} ${renderers.length} renderer${plural ? "s" : ""} configured in your \`astro.config.mjs\` file,
but ${plural ? "none were" : "it was not"} able to server-side render ${metadata.displayName}.

Did you mean to enable ${formatList(probableRendererNames.map((r) => "`" + r + "`"))}?`);
      } else if (matchingRenderers.length === 1) {
        renderer = matchingRenderers[0];
        ({ html, attrs } = await renderer.ssr.renderToStaticMarkup.call(
          { result },
          Component,
          props,
          children,
          metadata
        ));
      } else {
        throw new Error(`Unable to render ${metadata.displayName}!

This component likely uses ${formatList(probableRendererNames)},
but Astro encountered an error during server-side rendering.

Please ensure that ${metadata.displayName}:
1. Does not unconditionally access browser-specific globals like \`window\` or \`document\`.
   If this is unavoidable, use the \`client:only\` hydration directive.
2. Does not conditionally return \`null\` or \`undefined\` when rendered on the server.

If you're still stuck, please open an issue on GitHub or join us at https://astro.build/chat.`);
      }
    }
  } else {
    if (metadata.hydrate === "only") {
      html = await renderSlot(result, slots == null ? void 0 : slots.fallback);
    } else {
      ({ html, attrs } = await renderer.ssr.renderToStaticMarkup.call(
        { result },
        Component,
        props,
        children,
        metadata
      ));
    }
  }
  if (renderer && !renderer.clientEntrypoint && renderer.name !== "@astrojs/lit" && metadata.hydrate) {
    throw new Error(
      `${metadata.displayName} component has a \`client:${metadata.hydrate}\` directive, but no client entrypoint was provided by ${renderer.name}!`
    );
  }
  if (!html && typeof Component === "string") {
    const childSlots = Object.values(children).join("");
    const iterable = renderAstroComponent(
      await renderTemplate`<${Component}${internalSpreadAttributes(props)}${markHTMLString(
        childSlots === "" && voidElementNames.test(Component) ? `/>` : `>${childSlots}</${Component}>`
      )}`
    );
    html = "";
    for await (const chunk of iterable) {
      html += chunk;
    }
  }
  if (!hydration) {
    if (isPage || (renderer == null ? void 0 : renderer.name) === "astro:jsx") {
      return html;
    }
    return markHTMLString(html.replace(/\<\/?astro-slot\>/g, ""));
  }
  const astroId = shorthash(
    `<!--${metadata.componentExport.value}:${metadata.componentUrl}-->
${html}
${serializeProps(
      props,
      metadata
    )}`
  );
  const island = await generateHydrateScript(
    { renderer, result, astroId, props, attrs },
    metadata
  );
  let unrenderedSlots = [];
  if (html) {
    if (Object.keys(children).length > 0) {
      for (const key of Object.keys(children)) {
        if (!html.includes(key === "default" ? `<astro-slot>` : `<astro-slot name="${key}">`)) {
          unrenderedSlots.push(key);
        }
      }
    }
  } else {
    unrenderedSlots = Object.keys(children);
  }
  const template = unrenderedSlots.length > 0 ? unrenderedSlots.map(
    (key) => `<template data-astro-template${key !== "default" ? `="${key}"` : ""}>${children[key]}</template>`
  ).join("") : "";
  island.children = `${html ?? ""}${template}`;
  if (island.children) {
    island.props["await-children"] = "";
  }
  async function* renderAll() {
    if (slotInstructions) {
      yield* slotInstructions;
    }
    yield { type: "directive", hydration, result };
    yield markHTMLString(renderElement$1("astro-island", island, false));
  }
  return renderAll();
}

const uniqueElements = (item, index, all) => {
  const props = JSON.stringify(item.props);
  const children = item.children;
  return index === all.findIndex((i) => JSON.stringify(i.props) === props && i.children == children);
};
function renderHead(result) {
  result._metadata.hasRenderedHead = true;
  const styles = Array.from(result.styles).filter(uniqueElements).map((style) => renderElement$1("style", style));
  result.styles.clear();
  const scripts = Array.from(result.scripts).filter(uniqueElements).map((script, i) => {
    return renderElement$1("script", script, false);
  });
  const links = Array.from(result.links).filter(uniqueElements).map((link) => renderElement$1("link", link, false));
  return markHTMLString(links.join("\n") + styles.join("\n") + scripts.join("\n"));
}
async function* maybeRenderHead(result) {
  if (result._metadata.hasRenderedHead) {
    return;
  }
  yield renderHead(result);
}

typeof process === "object" && Object.prototype.toString.call(process) === "[object process]";

function createComponent(cb) {
  cb.isAstroComponentFactory = true;
  return cb;
}
function spreadAttributes(values, _name, { class: scopedClassName } = {}) {
  let output = "";
  if (scopedClassName) {
    if (typeof values.class !== "undefined") {
      values.class += ` ${scopedClassName}`;
    } else if (typeof values["class:list"] !== "undefined") {
      values["class:list"] = [values["class:list"], scopedClassName];
    } else {
      values.class = scopedClassName;
    }
  }
  for (const [key, value] of Object.entries(values)) {
    output += addAttribute(value, key, true);
  }
  return markHTMLString(output);
}

const AstroJSX = "astro:jsx";
const Empty = Symbol("empty");
const toSlotName = (str) => str.trim().replace(/[-_]([a-z])/g, (_, w) => w.toUpperCase());
function isVNode(vnode) {
  return vnode && typeof vnode === "object" && vnode[AstroJSX];
}
function transformSlots(vnode) {
  if (typeof vnode.type === "string")
    return vnode;
  const slots = {};
  if (isVNode(vnode.props.children)) {
    const child = vnode.props.children;
    if (!isVNode(child))
      return;
    if (!("slot" in child.props))
      return;
    const name = toSlotName(child.props.slot);
    slots[name] = [child];
    slots[name]["$$slot"] = true;
    delete child.props.slot;
    delete vnode.props.children;
  }
  if (Array.isArray(vnode.props.children)) {
    vnode.props.children = vnode.props.children.map((child) => {
      if (!isVNode(child))
        return child;
      if (!("slot" in child.props))
        return child;
      const name = toSlotName(child.props.slot);
      if (Array.isArray(slots[name])) {
        slots[name].push(child);
      } else {
        slots[name] = [child];
        slots[name]["$$slot"] = true;
      }
      delete child.props.slot;
      return Empty;
    }).filter((v) => v !== Empty);
  }
  Object.assign(vnode.props, slots);
}
function markRawChildren(child) {
  if (typeof child === "string")
    return markHTMLString(child);
  if (Array.isArray(child))
    return child.map((c) => markRawChildren(c));
  return child;
}
function transformSetDirectives(vnode) {
  if (!("set:html" in vnode.props || "set:text" in vnode.props))
    return;
  if ("set:html" in vnode.props) {
    const children = markRawChildren(vnode.props["set:html"]);
    delete vnode.props["set:html"];
    Object.assign(vnode.props, { children });
    return;
  }
  if ("set:text" in vnode.props) {
    const children = vnode.props["set:text"];
    delete vnode.props["set:text"];
    Object.assign(vnode.props, { children });
    return;
  }
}
function createVNode(type, props) {
  const vnode = {
    [Renderer]: "astro:jsx",
    [AstroJSX]: true,
    type,
    props: props ?? {}
  };
  transformSetDirectives(vnode);
  transformSlots(vnode);
  return vnode;
}

const ClientOnlyPlaceholder = "astro-client-only";
const skipAstroJSXCheck = /* @__PURE__ */ new WeakSet();
let originalConsoleError;
let consoleFilterRefs = 0;
async function renderJSX(result, vnode) {
  switch (true) {
    case vnode instanceof HTMLString:
      if (vnode.toString().trim() === "") {
        return "";
      }
      return vnode;
    case typeof vnode === "string":
      return markHTMLString(escapeHTML(vnode));
    case (!vnode && vnode !== 0):
      return "";
    case Array.isArray(vnode):
      return markHTMLString(
        (await Promise.all(vnode.map((v) => renderJSX(result, v)))).join("")
      );
  }
  if (isVNode(vnode)) {
    switch (true) {
      case !vnode.type: {
        throw new Error(`Unable to render ${result._metadata.pathname} because it contains an undefined Component!
Did you forget to import the component or is it possible there is a typo?`);
      }
      case vnode.type === Symbol.for("astro:fragment"):
        return renderJSX(result, vnode.props.children);
      case vnode.type.isAstroComponentFactory: {
        let props = {};
        let slots = {};
        for (const [key, value] of Object.entries(vnode.props ?? {})) {
          if (key === "children" || value && typeof value === "object" && value["$$slot"]) {
            slots[key === "children" ? "default" : key] = () => renderJSX(result, value);
          } else {
            props[key] = value;
          }
        }
        return markHTMLString(await renderToString(result, vnode.type, props, slots));
      }
      case (!vnode.type && vnode.type !== 0):
        return "";
      case (typeof vnode.type === "string" && vnode.type !== ClientOnlyPlaceholder):
        return markHTMLString(await renderElement(result, vnode.type, vnode.props ?? {}));
    }
    if (vnode.type) {
      let extractSlots2 = function(child) {
        if (Array.isArray(child)) {
          return child.map((c) => extractSlots2(c));
        }
        if (!isVNode(child)) {
          _slots.default.push(child);
          return;
        }
        if ("slot" in child.props) {
          _slots[child.props.slot] = [..._slots[child.props.slot] ?? [], child];
          delete child.props.slot;
          return;
        }
        _slots.default.push(child);
      };
      if (typeof vnode.type === "function" && vnode.type["astro:renderer"]) {
        skipAstroJSXCheck.add(vnode.type);
      }
      if (typeof vnode.type === "function" && vnode.props["server:root"]) {
        const output2 = await vnode.type(vnode.props ?? {});
        return await renderJSX(result, output2);
      }
      if (typeof vnode.type === "function" && !skipAstroJSXCheck.has(vnode.type)) {
        useConsoleFilter();
        try {
          const output2 = await vnode.type(vnode.props ?? {});
          if (output2 && output2[AstroJSX]) {
            return await renderJSX(result, output2);
          } else if (!output2) {
            return await renderJSX(result, output2);
          }
        } catch (e) {
          skipAstroJSXCheck.add(vnode.type);
        } finally {
          finishUsingConsoleFilter();
        }
      }
      const { children = null, ...props } = vnode.props ?? {};
      const _slots = {
        default: []
      };
      extractSlots2(children);
      for (const [key, value] of Object.entries(props)) {
        if (value["$$slot"]) {
          _slots[key] = value;
          delete props[key];
        }
      }
      const slotPromises = [];
      const slots = {};
      for (const [key, value] of Object.entries(_slots)) {
        slotPromises.push(
          renderJSX(result, value).then((output2) => {
            if (output2.toString().trim().length === 0)
              return;
            slots[key] = () => output2;
          })
        );
      }
      await Promise.all(slotPromises);
      let output;
      if (vnode.type === ClientOnlyPlaceholder && vnode.props["client:only"]) {
        output = await renderComponent(
          result,
          vnode.props["client:display-name"] ?? "",
          null,
          props,
          slots
        );
      } else {
        output = await renderComponent(
          result,
          typeof vnode.type === "function" ? vnode.type.name : vnode.type,
          vnode.type,
          props,
          slots
        );
      }
      if (typeof output !== "string" && Symbol.asyncIterator in output) {
        let parts = new HTMLParts();
        for await (const chunk of output) {
          parts.append(chunk, result);
        }
        return markHTMLString(parts.toString());
      } else {
        return markHTMLString(output);
      }
    }
  }
  return markHTMLString(`${vnode}`);
}
async function renderElement(result, tag, { children, ...props }) {
  return markHTMLString(
    `<${tag}${spreadAttributes(props)}${markHTMLString(
      (children == null || children == "") && voidElementNames.test(tag) ? `/>` : `>${children == null ? "" : await renderJSX(result, children)}</${tag}>`
    )}`
  );
}
function useConsoleFilter() {
  consoleFilterRefs++;
  if (!originalConsoleError) {
    originalConsoleError = console.error;
    try {
      console.error = filteredConsoleError;
    } catch (error) {
    }
  }
}
function finishUsingConsoleFilter() {
  consoleFilterRefs--;
}
function filteredConsoleError(msg, ...rest) {
  if (consoleFilterRefs > 0 && typeof msg === "string") {
    const isKnownReactHookError = msg.includes("Warning: Invalid hook call.") && msg.includes("https://reactjs.org/link/invalid-hook-call");
    if (isKnownReactHookError)
      return;
  }
  originalConsoleError(msg, ...rest);
}

const slotName = (str) => str.trim().replace(/[-_]([a-z])/g, (_, w) => w.toUpperCase());
async function check(Component, props, { default: children = null, ...slotted } = {}) {
  if (typeof Component !== "function")
    return false;
  const slots = {};
  for (const [key, value] of Object.entries(slotted)) {
    const name = slotName(key);
    slots[name] = value;
  }
  try {
    const result = await Component({ ...props, ...slots, children });
    return result[AstroJSX];
  } catch (e) {
  }
  return false;
}
async function renderToStaticMarkup(Component, props = {}, { default: children = null, ...slotted } = {}) {
  const slots = {};
  for (const [key, value] of Object.entries(slotted)) {
    const name = slotName(key);
    slots[name] = value;
  }
  const { result } = this;
  const html = await renderJSX(result, createVNode(Component, { ...props, ...slots, children }));
  return { html };
}
var server_default = {
  check,
  renderToStaticMarkup
};

const $$metadata$8 = createMetadata("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/layouts/layout.astro", { modules: [], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$8 = createAstro("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/layouts/layout.astro", "", "file:///Users/arpanpandey/Mirror/Code/aeromates/as-front/");
const $$Layout = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$8, $$props, $$slots);
  Astro2.self = $$Layout;
  return renderTemplate`<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <meta name="generator"${addAttribute(Astro2.generator, "content")}>
    <title>Aeromated</title>
  ${renderHead($$result)}</head>
  <body>
    <div class="container">
      <nav>
        <ul>
          <a href="/"><li><strong>Aeromated</strong></li></a>
        </ul>
        <ul>
          <li><a href="/quiz" role="button" class="outline">Take the quiz!</a></li>
          <li><a href="/course" role="button">Take the leap!</a></li>
        </ul>
      </nav>
      <main>
        ${renderSlot($$result, $$slots["default"])}
      </main>
    </div>
  </body></html>`;
});

const $$file$8 = "/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/layouts/layout.astro";
const $$url$8 = undefined;

const $$module1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$8,
  default: $$Layout,
  file: $$file$8,
  url: $$url$8
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$7 = createMetadata("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/index.astro", { modules: [{ module: $$module1, specifier: "../layouts/layout.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$7 = createAstro("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/index.astro", "", "file:///Users/arpanpandey/Mirror/Code/aeromates/as-front/");
const $$Index$1 = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$7, $$props, $$slots);
  Astro2.self = $$Index$1;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, {}, { "default": () => renderTemplate`${maybeRenderHead($$result)}<header>
    <h1 style="font-size: 550%; text-align: center; text-justify: auto; background: #105BD8;
background: linear-gradient(to right, #ff4d4d 0%, #f9cb28 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;">
      Aeromated
    </h1>
    <p>
      Over the past 60 years, the average temperature across Alaska has increased by approximately 3°F. This increase is more than twice the warming seen in the rest of the United States. Warming in the winter has increased by an average of 6°F and has led to changes in ecosystems, such as earlier breakup of river ice in the spring.

</p><p> Click on the button below to know more about climate change has affected our natural habitats because what happens in Alaska today will happen in your town tomorrow.
</p>
    
    <div style="text-align: center;">
      <a href="/course" role="button" class="secondary">Dive right in!</a>
    </div>
  </header>` })}`;
});

const $$file$7 = "/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/index.astro";
const $$url$7 = "";

const _page0 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$7,
  default: $$Index$1,
  file: $$file$7,
  url: $$url$7
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$6 = createMetadata("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/leaderboard.astro", { modules: [{ module: $$module1, specifier: "../layouts/layout.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$6 = createAstro("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/leaderboard.astro", "", "file:///Users/arpanpandey/Mirror/Code/aeromates/as-front/");
const $$Leaderboard = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$6, $$props, $$slots);
  Astro2.self = $$Leaderboard;
  const response = await fetch(
    `https://aeromates.hasura.app/api/rest/get-latest?limit=200`,
    {
      method: "GET",
      headers: {
        "x-hasura-admin-secret": "5skwIxmp5eb1riR4pqY4GeRIDzQz2v4m7BO84tD8PoLhp0YPQuvmAfJ1BLM8gcQy"
      }
    }
  );
  let leaderboard = await response.json();
  leaderboard = leaderboard["quizzes_quizzes"];
  if (!leaderboard) {
    leaderboard = [];
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, {}, { "default": () => renderTemplate`${maybeRenderHead($$result)}<h1>Leaderboard</h1><table>
        <thead>
        <tr>
            <th>Rank</th>
            <th>Name</th>
            <th>Score</th>
        </tr>
        </thead>
        <tbody>
        ${leaderboard.map((row, index) => renderTemplate`<tr>
            <td>${index + 1}</td>
            <td>${row.name ? row.name : "Anonymous User"}</td>
            <td>${row.score}</td>
            </tr>`)}
        </tbody>
    </table>` })}`;
});

const $$file$6 = "/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/leaderboard.astro";
const $$url$6 = "/leaderboard";

const _page1 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$6,
  default: $$Leaderboard,
  file: $$file$6,
  url: $$url$6
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$5 = createMetadata("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/credits.astro", { modules: [{ module: $$module1, specifier: "../layouts/layout.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$5 = createAstro("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/credits.astro", "", "file:///Users/arpanpandey/Mirror/Code/aeromates/as-front/");
const $$Credits = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$5, $$props, $$slots);
  Astro2.self = $$Credits;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, {}, { "default": () => renderTemplate`${maybeRenderHead($$result)}<p>
        </p><h1>Credits</h1><ul>
            <li> </li>
        </ul>` })}`;
});

const $$file$5 = "/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/credits.astro";
const $$url$5 = "/credits";

const _page2 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$5,
  default: $$Credits,
  file: $$file$5,
  url: $$url$5
}, Symbol.toStringTag, { value: 'Module' }));

const $$metadata$4 = createMetadata("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/course/index.astro", { modules: [{ module: $$module1, specifier: "../../layouts/layout.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$4 = createAstro("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/course/index.astro", "", "file:///Users/arpanpandey/Mirror/Code/aeromates/as-front/");
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$4, $$props, $$slots);
  Astro2.self = $$Index;
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, {}, { "default": () => renderTemplate`${maybeRenderHead($$result)}<h1>Welcome to the course!</h1><p>
    So, you have decided to learn about the adverse effects of climate change in
    the Alaskan regions? If so, you are at the right spot we, the Aeromates,
    have designed this short course to teach you about the same with real NASA
    data. <br> Switch on your researcher mode and let's explore what secrets lie
    in NASA's goldmine.
  </p><details open>
    <summary>What we do?</summary>
    <p>
      Visualise NASA's Arctic-Boreal Vulnerability Experiment (ABoVE) dataset
      and link the changing climate with vegetation and wildlife in Alaska and
      Canada.
    </p>
    <p>
      Over the past 60 years, the average temperature across Alaska has
      increased by approximately 3°F. This increase is more than twice the
      warming seen in the rest of the United States. Warming in the winter has
      increased by an average of 6°F and has led to changes in ecosystems, such
      as earlier breakup of river ice in the spring.
    </p>
    <p>
      Rising temperatures may provide some benefits in Alaska, such as a longer
      growing season for agricultural crops, increased tourism, and access to
      natural resources that are currently inaccessible due to ice cover, like
      offshore oil. However, climate change is also having adverse effects on
      many ecosystems and species, and is creating new hardships for Native
      Alaskans.
    </p>
    <div style="text-align: center;">
      <img src="https://grist.org/wp-content/uploads/2019/10/ak-heatwave-20190704-08_large.gif?w=1200" width="500">
    </div>
  </details><details>
    <summary>Impacts of Climate Change</summary>
    <p>
      All of humanity, but especially, the people in Alaska and Canada. The
      hunting patterns and endemic population datasets will paint a great
      picture of the impacts of climate change on our lives, economies and the
      planet as a whole.
    </p>
    <a href="/course/temp" role="button" style="width:100%">See Graphically</a>
    <div style="height: 15px;"> </div>
    <div style="
    display: grid;
    grid-template-columns: 600px 500px;
    grid-gap: 10px;
    color: #444;">
      <div style="text-align: center;">
        <img src="https://grist.org/wp-content/uploads/2019/10/fire.jpg" width="800">
      </div>
      <div style="text-align: center;">
        <img src="https://nca2014.globalchange.gov/sites/report/files/images/web-small/Figure-22.1-small.jpg" width="800">
      </div>
    </div>
  </details><details>
    <summary>Retreating Sea Ice</summary>
    <p>
      In the spring, hunters set up camps on the ice where they butcher the
      animals they catch. But with temperatures in Utqiaġvik rising at some of
      the fastest recorded rates on Earth, the so-called landfast ice is
      breaking up earlier in the spring, reducing the amount of time it can be
      used for hunting. The ice that’s present is becoming weaker and more
      dangerous. 
      </p><p> 
      Most glaciers in Alaska and British Columbia are shrinking
      substantially. This trend is expected to continue and has implications for
      hydropower production, ocean circulation patterns, fisheries, and global
      sea level rise.
      </p>
    
    <div style="text-align: center;">
      <img src="https://grist.org/wp-content/uploads/2019/10/bering_jfma_sie.gif?w=1200" width="800">
    </div>
  </details><details>
    <summary>Wildfire</summary>
    <p>
      Fires torched some 2.6 million acres across the state this year, and
      although that’s far from Alaska’s worst wildfire season — in 2004, a
      staggering 6.5 million acres burned statewide — 2019 will go down as one
      of the ten largest wildfire years since 1940. Big years like it are
      occurring far more often than they used to.
    </p>
  </details>` })}`;
});

const $$file$4 = "/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/course/index.astro";
const $$url$4 = "/course";

const _page3 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$4,
  default: $$Index,
  file: $$file$4,
  url: $$url$4
}, Symbol.toStringTag, { value: 'Module' }));

var __freeze$3 = Object.freeze;
var __defProp$3 = Object.defineProperty;
var __template$3 = (cooked, raw) => __freeze$3(__defProp$3(cooked, "raw", { value: __freeze$3(raw || cooked.slice()) }));
var _a$3;
const $$metadata$3 = createMetadata("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/course/wildfire.astro", { modules: [{ module: $$module1, specifier: "../../layouts/layout.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$3 = createAstro("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/course/wildfire.astro", "", "file:///Users/arpanpandey/Mirror/Code/aeromates/as-front/");
const $$Wildfire = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$3, $$props, $$slots);
  Astro2.self = $$Wildfire;
  return renderTemplate(_a$3 || (_a$3 = __template$3(["", '\n<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>\n\n<script>\n  const labels = [\n    "1",\n    "2",\n    "3",\n    "4",\n    "5",\n    "6",\n    "7",\n    "8",\n    "9",\n    "10",\n    "11",\n    "12",\n    "13",\n    "14",\n    "15",\n    "16",\n    "17",\n    "18",\n    "19",\n    "20",\n    "21",\n    "22",\n    "23",\n    "24",\n    "25",\n  ];\n\n  const data1 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          11.1, 11.1, 11.1, 11.1, 10.6, 10, 10, 8.9, 11.1, 10.6, 10, 7.8, 10.6,\n          9.4, 8.9, 6.1, 5.6, 6.7, 7.2, 11.7, 10, 10, 6.7, 6.1,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          7.8, 3.3, 5.6, 5.6, 6.1, 5.6, 5, 1.7, -1.7, 5, 3.9, 4.4, -1.1, -1.7,\n          -3.3, -1.7, -4.4, -2.2, 1.1, 3.3, 5, 5.6, -0.6, -1.7, 3.3,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          9.4, 7.2, 8.3, 8.3, 8.3, 7.8, 7.8, 5.6, 5, 7.8, 7.2, 6.1, 5, 4.4, 3.3,\n          3.9, 1.1, 1.7, 3.9, 5.6, 8.3, 7.8, 5, 2.8, 5,\n        ],\n      },\n    ],\n  };\n\n  const config1 = {\n    type: "line",\n    data: data1,\n    options: {},\n  };\n  const myChart1 = new Chart(document.getElementById("chart1"), config1);\n\n  const data2 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          17.2, 16.7, 15, 15, 10.6, 11.7, 11.7, 10.6, 15.6, 17.2, 16.7, 15,\n          13.9, 11.1, 12.2, 13.9, 13.3, 13.3, 11.7, 15, 14.4, 13.9, 14.4, 13.3,\n          12.8,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          6.7, 5, 5, 6.7, 7.2, 6.7, 5, 5.6, 6.1, 3.3, 0.6, 0.6, 4.4, 2.8, 4.4,\n          -1.1, 0.6, 2.2, 4.4, 4.4, -0.6, -1.7, 3.3, -2.2, 2.2,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          12.2, 11.1, 10, 11.1, 8.9, 9.4, 8.3, 8.3, 11.1, 10.6, 8.9, 7.8, 9.4,\n          7.2, 8.3, 6.7, 7.2, 7.8, 8.3, 10, 7.2, 6.1, 8.9, 5.6, 7.8,\n        ],\n      },\n    ],\n  };\n\n  const config2 = {\n    type: "line",\n    data: data2,\n    options: {},\n  };\n  const myChart2 = new Chart(document.getElementById("chart2"), config2);\n\n  const data3 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          16.1, 14.4, 12.8, 13.3, 13.9, 14.4, 13.3, 11.7, 8.9, 8.3, 8.3, 8.9,\n          11.1, 17.8, 15, 7.8, 8.3, 8.3, 5.6, 6.7, 9.4, 12.8, 13.3, 13.9, 13.9,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          1.7, 4.4, 6.7, 8.3, 11.1, 10.6, 7.8, 3.3, 1.1, 2.2, 5.6, 3.3, 7.8,\n          6.7, 3.9, -1.1, -1.7, 3.3, 0, -2.2, -6.1, -3.9, -1.7, 6.7, 5.6,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          8.9, 9.4, 10, 11.1, 12.8, 12.8, 10.6, 7.8, 5, 5.6, 7.2, 6.1, 9.4,\n          12.2, 9.4, 3.3, 3.3, 6.1, 2.8, 2.2, 1.7, 4.4, 6.1, 10.6, 10,\n        ],\n      },\n    ],\n  };\n\n  const config3 = {\n    type: "line",\n    data: data3,\n    options: {},\n  };\n  const myChart3 = new Chart(document.getElementById("chart3"), config3);\n\n  const data4 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          18.3, 17.2, 12.8, 11.7, 11.7, 12.8, 16.1, 14.4, 11.1, 11.1, 10, 9.4,\n          9.4, 10.6, 12.2, 11.7, 10.6, 7.8, 7.8, 7.8, 8.9, 9.4, 7.8, 7.8, 6.7,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          7.8, 9.4, 5, 6.7, 3.9, -0.6, 2.8, 2.8, 2.2, -2.2, 4.4, -1.7, -5, -5,\n          -5.6, -1.1, -3.9, -6.7, -7.2, -7.8, -6.1, -9.4, -7.2, -3.3, -6.7,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          13.3, 13.3, 8.9, 9.4, 7.8, 6.1, 9.4, 8.9, 6.7, 4.4, 7.2, 3.9, 2.2,\n          2.8, 3.3, 5.6, 3.3, 0.6, 0.6, 0, 1.7, 0, 0.6, 2.2, 0,\n        ],\n      },\n    ],\n  };\n  const config4 = {\n    type: "line",\n    data: data4,\n    options: {},\n  };\n  const myChart4 = new Chart(document.getElementById("chart4"), config4);\n\n  const data5 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          16.7, 12.2, 13.3, 12.8, 13.9, 14.4, 15.6, 16.7, 17.2, 17.8, 13.9,\n          11.7, 8.9, 8.3, 7.2, 7.8, 7.8, 7.2, 6.7, 6.7, 5, 3.9, 4.4, 2.8, 5.6,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          7.2, -0.6, -1.7, 3.9, 0.6, -2.8, -3.3, -2.8, -2.2, -2.2, 2.8, 3.9,\n          1.7, 0.6, 0.6, -1.7, -3.9, -5.6, -1.1, 0, -1.7, 1.7, -2.2, -1.7, -1.7,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          12.2, 6.1, 6.1, 8.3, 7.2, 6.1, 6.1, 7.2, 7.8, 7.8, 8.3, 7.8, 5.6, 4.4,\n          3.9, 3.3, 2.2, 1.1, 2.8, 3.3, 1.7, 2.8, 1.1, 0.6, 2.2,\n        ],\n      },\n    ],\n  };\n\n  const config5 = {\n    type: "line",\n    data: data5,\n    options: {},\n  };\n\n  const myChart5 = new Chart(document.getElementById("chart5"), config5);\n\n  const data6 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          20.6, 20, 16.1, 21.1, 20.6, 20.6, 15.6, 16.1, 18.3, 18.3, 18.3, 13.9,\n          17.8, 17.8, 20, 17.8, 18.3, 15.6, 20, 18.3, 12.2, 12.2, 10.6, 8.3,\n          7.8,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          3.9, 3.3, -0.6, -0.6, 2.2, 4.4, 10, 8.9, 8.3, 6.1, 6.7, 6.1, 5.6, 8.9,\n          10, 10.6, 5, 8.9, 1.1, 3.3, 7.8, 6.1, 5, 1.7, -0.6,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          12.2, 11.7, 7.8, 10.6, 11.7, 12.8, 12.8, 12.8, 13.3, 12.2, 12.8, 10,\n          11.7, 13.3, 15, 14.4, 11.7, 12.2, 10.6, 11.1, 10, 9.4, 7.8, 5, 3.9,\n        ],\n      },\n    ],\n  };\n\n  const config6 = {\n    type: "line",\n    data: data6,\n    options: {},\n  };\n\n  const myChart6 = new Chart(document.getElementById("chart6"), config6);\n\n  const data7 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          12.8, 14.4, 16.7, 19.4, 21.1, 22.8, 15, 16.7, 16.7, 17.8, 17.8, 12.8,\n          12.8, 15.6, 17.8, 17.2, 17.2, 15.6, 12.2, 8.9, 7.8, 3.3, 3.3, 3.3,\n          3.3,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          8.3, 8.9, 3.9, 2.8, 2.2, 1.7, 2.8, 3.3, 2.2, 3.3, 5.6, 5, 5.6, 5, 2.2,\n          2.8, 7.8, 6.7, 4.4, 3.9, 0, -0.6, 0.6, -2.2, -3.9,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          10.6, 11.7, 10.6, 11.1, 11.7, 12.2, 8.9, 10, 9.4, 10.6, 11.7, 8.9,\n          9.4, 10.6, 10, 10, 12.8, 11.1, 8.3, 6.7, 3.9, 1.7, 2.2, 0.6, 0,\n        ],\n      },\n    ],\n  };\n\n  const config7 = {\n    type: "line",\n    data: data7,\n    options: {},\n  };\n\n  const myChart7 = new Chart(document.getElementById("chart7"), config7);\n\n  const data8 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          12.2, 12.8, 12.8, 8.3, 10.6, 10.6, 9.4, 10, 10, 10, 15.6, 10.6, 9.4,\n          10, 9.4, 8.9, 6.7, 7.8, 7.8, 8.9, 9.4, 10, 7.2, 4.4, 5.6,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          2.2, 6.7, 3.3, 1.1, 5, 6.1, 3.9, 1.7, -1.7, -4.4, -2.8, -3.9, -2.2,\n          -4.4, -1.7, 6.7, 5, 0, 6.1, 4.4, 3.9, 3.9, 3.3, -2.2, -2.2,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          7.2, 9.7, 8.1, 4.7, 7.8, 8.3, 6.7, 5.8, 4.2, 2.8, 6.4, 3.3, 3.6, 2.8,\n          3.9, 7.8, 5.8, 3.9, 6.9, 6.7, 6.7, 6.9, 5.3, 1.1,\n        ],\n      },\n    ],\n  };\n\n  const config8 = {\n    type: "line",\n    data: data8,\n    options: {},\n  };\n\n  const myChart8 = new Chart(document.getElementById("chart8"), config8);\n\n  const data9 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          20.6, 17.8, 17.8, 17.8, 16.7, 11.7, 12.8, 15, 17.2, 15, 8.9, 12.2,\n          8.9, 7.2, 5.6, 8.9, 6.1, 6.7, 10.6, 11.1, 11.1, 5.6, 7.2, 6.1, 7.2,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          3.9, 5, 2.8, 1.7, 7.8, 5.6, -2.2, 0, 1.7, 6.1, 2.2, 7.2, 5.6, 2.8,\n          2.8, 1.7, 3.9, 2.8, 5, 8.9, 5.6, 0.6, 2.8, -1.1, 0.6,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          7.2, 9.7, 8.1, 4.7, 7.8, 8.3, 6.7, 5.8, 4.2, 2.8, 6.4, 3.3, 3.6, 2.8,\n          3.9, 7.8, 5.8, 3.9, 6.9, 6.7, 6.7, 6.9, 5.3, 1.1,\n        ],\n      },\n    ],\n  };\n\n  const config9 = {\n    type: "line",\n    data: data9,\n    options: {},\n  };\n\n  const myChart9 = new Chart(document.getElementById("chart9"), config9);\n  const data10 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "2000",\n        backgroundColor: "#e53935",\n        borderColor: "#e53935",\n        data: [\n          9.4, 7.2, 8.3, 8.3, 8.3, 7.8, 7.8, 5.6, 5, 7.8, 7.2, 6.1, 5, 4.4, 3.3,\n          3.9, 1.1, 1.7, 3.9, 5.6, 8.3, 7.8, 5, 2.8, 5,\n        ],\n      },\n      {\n        label: "2005",\n        backgroundColor: "#d81b60",\n        borderColor: "#d81b60",\n        data: [\n          12.2, 6.1, 6.1, 8.3, 7.2, 6.1, 6.1, 7.2, 7.8, 7.8, 8.3, 7.8, 5.6, 4.4,\n          3.9, 3.3, 2.2, 1.1, 2.8, 3.3, 1.7, 2.8, 1.1, 0.6, 2.2,\n        ],\n      },\n      {\n        label: "2010",\n        backgroundColor: "#8e24aa",\n        borderColor: "#8e24aa",\n        data: [\n          9.4, 11.7, 10.6, 10.6, 12.8, 12.8, 13.9, 11.7, 10, 11.1, 11.1, 11.1,\n          12.2, 11.7, 11.1, 8.3, 7.2, 7.2, 8.3, 7.8, 7.2, 6.1, 2.8, 1.7, 0.6,\n        ],\n      },\n      {\n        label: "2015",\n        backgroundColor: "#3949ab",\n        borderColor: "#3949ab",\n        data: [\n          8.1, 6.4, 13.9, 10, 8.9, 10.6, 10.3, 10, 8.1, 6.7, 5, 4.4, 7.2, 6.7,\n          3.6, 4.2, 4.7, 1.9, 1.4, 1.9, 2.2, 1.7, 0.8, 1.4, 4.2,\n        ],\n      },\n    ],\n  };\n\n  const config10 = {\n    type: "line",\n    data: data10,\n    options: {},\n  };\n\n  const myChart10 = new Chart(document.getElementById("chart10"), config10);\n<\/script>'])), renderComponent($$result, "Layout", $$Layout, {}, { "default": () => renderTemplate`${maybeRenderHead($$result)}<h1>Wildfires in Alaska</h1><p>
    Let's take you back to the beginning of the century to begin our
    experiments. According to the Environmental Conditions Report from NASA's
    Arctic-Boreal Vulnerability Experiment (ABoVE), which was a NASA Terrestrial
    Ecology Program campaign conducted in Alsaka and western Canada to help us
    understand how climate change is affecting Earth’s Arctic and Boreal
    regions. Here is the complete detailed data visualisation study of wildfires in Alaska.
  </p><h4>1. Average Temperature of 2000, 2005, 2010, and 2015.</h4><p> 
    The given graph shows the average temperature for each day for the month of september of 2000, 2005, 2010, and 2015.
    The irregularities are clealrly visible in the graph. One year is extremely hot while the other is cold. This is the effect
    of climate change on weather in Alaska.
  </p><canvas id="chart10"></canvas><h4>2. Temperature in the Year 2000.</h4><p>
    In the year 2000’s September month the average temperature goes maximum up to 8.3
    ℃ while it goes down to 1.1 ℃ in just a span of 25 days.
  </p><canvas id="chart1"></canvas><h4>3. Temperature in the Year 2001.</h4><p>
    In the year 2001’s September month the average temperature goes maximum up to 11.1
    ℃ while it goes down to 5.6 ℃ in just a span of 25 days.
  </p><canvas id="chart2"></canvas><h4>4. Temperature in the Year 2002.</h4><p> In the year 2002’s September month the average temperature goes maximum up to 12.2
  ℃ while it goes down to 1.7 ℃ in just a span of 25 days. </p><canvas id="chart3"></canvas><h4>5. Temperature in the Year 2003.</h4><p> In the year 2003’s September month the average temperature goes maximum up to 13.3
  ℃ while it goes down to 0  ℃ in just a span of 25 days. </p><canvas id="chart4"></canvas><h4>6. Temperature in the Year 2004.</h4><p> In the year 2004’s September month the average temperature goes maximum up to 12.2
  ℃ while it goes down to 0.6 ℃ in just a span of 25 days. </p><canvas id="chart5"></canvas><h4>7. Temperature in the Year 2006.</h4><p> In the year 2006’s September month the average temperature goes maximum up to 15
  ℃ while it goes down to 7.8 ℃ in just a span of 25 days. </p><canvas id="chart6"></canvas><h4>8. Temperature in the Year 2009.</h4><p> In the year 2009’s September month the average temperature goes maximum up to 12.8
  ℃ while it goes down to 0.0 ℃ in just a span of 25 days. </p><canvas id="chart7"></canvas><h4>9. Temperature in the Year 2012.</h4><p> In the year 2012’s September month the average temperature goes maximum up to 9.7
  ℃ while it goes down to 1.1 ℃ in just a span of 25 days. </p><canvas id="chart8"></canvas><h4>10. Temperature in the Year 2016.</h4><p> In the year 2016’s September month the average temperature goes maximum up to 7.8
  ℃ while it goes down to 1.1 ℃ in just a span of 25 days. </p><canvas id="chart9"></canvas>` }));
});

const $$file$3 = "/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/course/wildfire.astro";
const $$url$3 = "/course/wildfire";

const _page4 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$3,
  default: $$Wildfire,
  file: $$file$3,
  url: $$url$3
}, Symbol.toStringTag, { value: 'Module' }));

var __freeze$2 = Object.freeze;
var __defProp$2 = Object.defineProperty;
var __template$2 = (cooked, raw) => __freeze$2(__defProp$2(cooked, "raw", { value: __freeze$2(raw || cooked.slice()) }));
var _a$2;
const $$metadata$2 = createMetadata("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/course/temp.astro", { modules: [{ module: $$module1, specifier: "../../layouts/layout.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$2 = createAstro("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/course/temp.astro", "", "file:///Users/arpanpandey/Mirror/Code/aeromates/as-front/");
const $$Temp = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$2, $$props, $$slots);
  Astro2.self = $$Temp;
  return renderTemplate(_a$2 || (_a$2 = __template$2(["", '\n<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>\n\n<script>\n  const labels = [\n    "1",\n    "2",\n    "3",\n    "4",\n    "5",\n    "6",\n    "7",\n    "8",\n    "9",\n    "10",\n    "11",\n    "12",\n    "13",\n    "14",\n    "15",\n    "16",\n    "17",\n    "18",\n    "19",\n    "20",\n    "21",\n    "22",\n    "23",\n    "24",\n    "25",\n  ];\n\n  const data1 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          11.1, 11.1, 11.1, 11.1, 10.6, 10, 10, 8.9, 11.1, 10.6, 10, 7.8, 10.6,\n          9.4, 8.9, 6.1, 5.6, 6.7, 7.2, 11.7, 10, 10, 6.7, 6.1,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          7.8, 3.3, 5.6, 5.6, 6.1, 5.6, 5, 1.7, -1.7, 5, 3.9, 4.4, -1.1, -1.7,\n          -3.3, -1.7, -4.4, -2.2, 1.1, 3.3, 5, 5.6, -0.6, -1.7, 3.3,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          9.4, 7.2, 8.3, 8.3, 8.3, 7.8, 7.8, 5.6, 5, 7.8, 7.2, 6.1, 5, 4.4, 3.3,\n          3.9, 1.1, 1.7, 3.9, 5.6, 8.3, 7.8, 5, 2.8, 5,\n        ],\n      },\n    ],\n  };\n\n  const config1 = {\n    type: "line",\n    data: data1,\n    options: {},\n  };\n  const myChart1 = new Chart(document.getElementById("chart1"), config1);\n\n  const data2 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          17.2, 16.7, 15, 15, 10.6, 11.7, 11.7, 10.6, 15.6, 17.2, 16.7, 15,\n          13.9, 11.1, 12.2, 13.9, 13.3, 13.3, 11.7, 15, 14.4, 13.9, 14.4, 13.3,\n          12.8,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          6.7, 5, 5, 6.7, 7.2, 6.7, 5, 5.6, 6.1, 3.3, 0.6, 0.6, 4.4, 2.8, 4.4,\n          -1.1, 0.6, 2.2, 4.4, 4.4, -0.6, -1.7, 3.3, -2.2, 2.2,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          12.2, 11.1, 10, 11.1, 8.9, 9.4, 8.3, 8.3, 11.1, 10.6, 8.9, 7.8, 9.4,\n          7.2, 8.3, 6.7, 7.2, 7.8, 8.3, 10, 7.2, 6.1, 8.9, 5.6, 7.8,\n        ],\n      },\n    ],\n  };\n\n  const config2 = {\n    type: "line",\n    data: data2,\n    options: {},\n  };\n  const myChart2 = new Chart(document.getElementById("chart2"), config2);\n\n  const data3 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          16.1, 14.4, 12.8, 13.3, 13.9, 14.4, 13.3, 11.7, 8.9, 8.3, 8.3, 8.9,\n          11.1, 17.8, 15, 7.8, 8.3, 8.3, 5.6, 6.7, 9.4, 12.8, 13.3, 13.9, 13.9,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          1.7, 4.4, 6.7, 8.3, 11.1, 10.6, 7.8, 3.3, 1.1, 2.2, 5.6, 3.3, 7.8,\n          6.7, 3.9, -1.1, -1.7, 3.3, 0, -2.2, -6.1, -3.9, -1.7, 6.7, 5.6,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          8.9, 9.4, 10, 11.1, 12.8, 12.8, 10.6, 7.8, 5, 5.6, 7.2, 6.1, 9.4,\n          12.2, 9.4, 3.3, 3.3, 6.1, 2.8, 2.2, 1.7, 4.4, 6.1, 10.6, 10,\n        ],\n      },\n    ],\n  };\n\n  const config3 = {\n    type: "line",\n    data: data3,\n    options: {},\n  };\n  const myChart3 = new Chart(document.getElementById("chart3"), config3);\n\n  const data4 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          18.3, 17.2, 12.8, 11.7, 11.7, 12.8, 16.1, 14.4, 11.1, 11.1, 10, 9.4,\n          9.4, 10.6, 12.2, 11.7, 10.6, 7.8, 7.8, 7.8, 8.9, 9.4, 7.8, 7.8, 6.7,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          7.8, 9.4, 5, 6.7, 3.9, -0.6, 2.8, 2.8, 2.2, -2.2, 4.4, -1.7, -5, -5,\n          -5.6, -1.1, -3.9, -6.7, -7.2, -7.8, -6.1, -9.4, -7.2, -3.3, -6.7,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          13.3, 13.3, 8.9, 9.4, 7.8, 6.1, 9.4, 8.9, 6.7, 4.4, 7.2, 3.9, 2.2,\n          2.8, 3.3, 5.6, 3.3, 0.6, 0.6, 0, 1.7, 0, 0.6, 2.2, 0,\n        ],\n      },\n    ],\n  };\n  const config4 = {\n    type: "line",\n    data: data4,\n    options: {},\n  };\n  const myChart4 = new Chart(document.getElementById("chart4"), config4);\n\n  const data5 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          16.7, 12.2, 13.3, 12.8, 13.9, 14.4, 15.6, 16.7, 17.2, 17.8, 13.9,\n          11.7, 8.9, 8.3, 7.2, 7.8, 7.8, 7.2, 6.7, 6.7, 5, 3.9, 4.4, 2.8, 5.6,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          7.2, -0.6, -1.7, 3.9, 0.6, -2.8, -3.3, -2.8, -2.2, -2.2, 2.8, 3.9,\n          1.7, 0.6, 0.6, -1.7, -3.9, -5.6, -1.1, 0, -1.7, 1.7, -2.2, -1.7, -1.7,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          12.2, 6.1, 6.1, 8.3, 7.2, 6.1, 6.1, 7.2, 7.8, 7.8, 8.3, 7.8, 5.6, 4.4,\n          3.9, 3.3, 2.2, 1.1, 2.8, 3.3, 1.7, 2.8, 1.1, 0.6, 2.2,\n        ],\n      },\n    ],\n  };\n\n  const config5 = {\n    type: "line",\n    data: data5,\n    options: {},\n  };\n\n  const myChart5 = new Chart(document.getElementById("chart5"), config5);\n\n  const data6 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          20.6, 20, 16.1, 21.1, 20.6, 20.6, 15.6, 16.1, 18.3, 18.3, 18.3, 13.9,\n          17.8, 17.8, 20, 17.8, 18.3, 15.6, 20, 18.3, 12.2, 12.2, 10.6, 8.3,\n          7.8,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          3.9, 3.3, -0.6, -0.6, 2.2, 4.4, 10, 8.9, 8.3, 6.1, 6.7, 6.1, 5.6, 8.9,\n          10, 10.6, 5, 8.9, 1.1, 3.3, 7.8, 6.1, 5, 1.7, -0.6,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          12.2, 11.7, 7.8, 10.6, 11.7, 12.8, 12.8, 12.8, 13.3, 12.2, 12.8, 10,\n          11.7, 13.3, 15, 14.4, 11.7, 12.2, 10.6, 11.1, 10, 9.4, 7.8, 5, 3.9,\n        ],\n      },\n    ],\n  };\n\n  const config6 = {\n    type: "line",\n    data: data6,\n    options: {},\n  };\n\n  const myChart6 = new Chart(document.getElementById("chart6"), config6);\n\n  const data7 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          12.8, 14.4, 16.7, 19.4, 21.1, 22.8, 15, 16.7, 16.7, 17.8, 17.8, 12.8,\n          12.8, 15.6, 17.8, 17.2, 17.2, 15.6, 12.2, 8.9, 7.8, 3.3, 3.3, 3.3,\n          3.3,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          8.3, 8.9, 3.9, 2.8, 2.2, 1.7, 2.8, 3.3, 2.2, 3.3, 5.6, 5, 5.6, 5, 2.2,\n          2.8, 7.8, 6.7, 4.4, 3.9, 0, -0.6, 0.6, -2.2, -3.9,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          10.6, 11.7, 10.6, 11.1, 11.7, 12.2, 8.9, 10, 9.4, 10.6, 11.7, 8.9,\n          9.4, 10.6, 10, 10, 12.8, 11.1, 8.3, 6.7, 3.9, 1.7, 2.2, 0.6, 0,\n        ],\n      },\n    ],\n  };\n\n  const config7 = {\n    type: "line",\n    data: data7,\n    options: {},\n  };\n\n  const myChart7 = new Chart(document.getElementById("chart7"), config7);\n\n  const data8 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          12.2, 12.8, 12.8, 8.3, 10.6, 10.6, 9.4, 10, 10, 10, 15.6, 10.6, 9.4,\n          10, 9.4, 8.9, 6.7, 7.8, 7.8, 8.9, 9.4, 10, 7.2, 4.4, 5.6,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          2.2, 6.7, 3.3, 1.1, 5, 6.1, 3.9, 1.7, -1.7, -4.4, -2.8, -3.9, -2.2,\n          -4.4, -1.7, 6.7, 5, 0, 6.1, 4.4, 3.9, 3.9, 3.3, -2.2, -2.2,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          7.2, 9.7, 8.1, 4.7, 7.8, 8.3, 6.7, 5.8, 4.2, 2.8, 6.4, 3.3, 3.6, 2.8,\n          3.9, 7.8, 5.8, 3.9, 6.9, 6.7, 6.7, 6.9, 5.3, 1.1,\n        ],\n      },\n    ],\n  };\n\n  const config8 = {\n    type: "line",\n    data: data8,\n    options: {},\n  };\n\n  const myChart8 = new Chart(document.getElementById("chart8"), config8);\n\n  const data9 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "Maximum temperature",\n        backgroundColor: "rgb(255, 99, 132)",\n        borderColor: "rgb(255, 99, 132)",\n        data: [\n          20.6, 17.8, 17.8, 17.8, 16.7, 11.7, 12.8, 15, 17.2, 15, 8.9, 12.2,\n          8.9, 7.2, 5.6, 8.9, 6.1, 6.7, 10.6, 11.1, 11.1, 5.6, 7.2, 6.1, 7.2,\n        ],\n      },\n      {\n        label: "Minimum temperature",\n        backgroundColor: "rgb(255, 99, 0)",\n        borderColor: "rgb(255, 99, 0)",\n        data: [\n          3.9, 5, 2.8, 1.7, 7.8, 5.6, -2.2, 0, 1.7, 6.1, 2.2, 7.2, 5.6, 2.8,\n          2.8, 1.7, 3.9, 2.8, 5, 8.9, 5.6, 0.6, 2.8, -1.1, 0.6,\n        ],\n      },\n      {\n        label: "Average temperature",\n        backgroundColor: "rgb(0, 99, 255)",\n        borderColor: "rgb(0, 99, 255)",\n        data: [\n          7.2, 9.7, 8.1, 4.7, 7.8, 8.3, 6.7, 5.8, 4.2, 2.8, 6.4, 3.3, 3.6, 2.8,\n          3.9, 7.8, 5.8, 3.9, 6.9, 6.7, 6.7, 6.9, 5.3, 1.1,\n        ],\n      },\n    ],\n  };\n\n  const config9 = {\n    type: "line",\n    data: data9,\n    options: {},\n  };\n\n  const myChart9 = new Chart(document.getElementById("chart9"), config9);\n  const data10 = {\n    labels: labels,\n    datasets: [\n      {\n        label: "2000",\n        backgroundColor: "#e53935",\n        borderColor: "#e53935",\n        data: [\n          9.4, 7.2, 8.3, 8.3, 8.3, 7.8, 7.8, 5.6, 5, 7.8, 7.2, 6.1, 5, 4.4, 3.3,\n          3.9, 1.1, 1.7, 3.9, 5.6, 8.3, 7.8, 5, 2.8, 5,\n        ],\n      },\n      {\n        label: "2005",\n        backgroundColor: "#d81b60",\n        borderColor: "#d81b60",\n        data: [\n          12.2, 6.1, 6.1, 8.3, 7.2, 6.1, 6.1, 7.2, 7.8, 7.8, 8.3, 7.8, 5.6, 4.4,\n          3.9, 3.3, 2.2, 1.1, 2.8, 3.3, 1.7, 2.8, 1.1, 0.6, 2.2,\n        ],\n      },\n      {\n        label: "2010",\n        backgroundColor: "#8e24aa",\n        borderColor: "#8e24aa",\n        data: [\n          9.4, 11.7, 10.6, 10.6, 12.8, 12.8, 13.9, 11.7, 10, 11.1, 11.1, 11.1,\n          12.2, 11.7, 11.1, 8.3, 7.2, 7.2, 8.3, 7.8, 7.2, 6.1, 2.8, 1.7, 0.6,\n        ],\n      },\n      {\n        label: "2015",\n        backgroundColor: "#3949ab",\n        borderColor: "#3949ab",\n        data: [\n          8.1, 6.4, 13.9, 10, 8.9, 10.6, 10.3, 10, 8.1, 6.7, 5, 4.4, 7.2, 6.7,\n          3.6, 4.2, 4.7, 1.9, 1.4, 1.9, 2.2, 1.7, 0.8, 1.4, 4.2,\n        ],\n      },\n    ],\n  };\n\n  const config10 = {\n    type: "line",\n    data: data10,\n    options: {},\n  };\n\n  const myChart10 = new Chart(document.getElementById("chart10"), config10);\n<\/script>'])), renderComponent($$result, "Layout", $$Layout, {}, { "default": () => renderTemplate`${maybeRenderHead($$result)}<h1>Temperature over the Years!</h1><p>
    Let's take you back to the beginning of the century to begin our
    experiments. According to the Environmental Conditions Report from NASA's
    Arctic-Boreal Vulnerability Experiment (ABoVE), which was a NASA Terrestrial
    Ecology Program campaign conducted in Alsaka and western Canada to help us
    understand how climate change is affecting Earth’s Arctic and Boreal
    regions. Here is the complete detailed data visualisation study of <b>September</b>(September marks the hunting season in Alaska and thus accessing data in this month
    offers some useful insights.) month that data which was given by NASA.
  </p><h4>1. Average Temperature of 2000, 2005, 2010, and 2015.</h4><p> 
    The given graph shows the average temperature for each day for the month of september of 2000, 2005, 2010, and 2015.
    The irregularities are clealrly visible in the graph. One year is extremely hot while the other is cold. This is the effect
    of climate change on weather in Alaska.
  </p><canvas id="chart10"></canvas><h4>2. Temperature in the Year 2000.</h4><p>
    In the year 2000’s September month the average temperature goes maximum up to 8.3
    ℃ while it goes down to 1.1 ℃ in just a span of 25 days.
  </p><canvas id="chart1"></canvas><h4>3. Temperature in the Year 2001.</h4><p>
    In the year 2001’s September month the average temperature goes maximum up to 11.1
    ℃ while it goes down to 5.6 ℃ in just a span of 25 days.
  </p><canvas id="chart2"></canvas><h4>4. Temperature in the Year 2002.</h4><p> In the year 2002’s September month the average temperature goes maximum up to 12.2
  ℃ while it goes down to 1.7 ℃ in just a span of 25 days. </p><canvas id="chart3"></canvas><h4>5. Temperature in the Year 2003.</h4><p> In the year 2003’s September month the average temperature goes maximum up to 13.3
  ℃ while it goes down to 0  ℃ in just a span of 25 days. </p><canvas id="chart4"></canvas><h4>6. Temperature in the Year 2004.</h4><p> In the year 2004’s September month the average temperature goes maximum up to 12.2
  ℃ while it goes down to 0.6 ℃ in just a span of 25 days. </p><canvas id="chart5"></canvas><h4>7. Temperature in the Year 2006.</h4><p> In the year 2006’s September month the average temperature goes maximum up to 15
  ℃ while it goes down to 7.8 ℃ in just a span of 25 days. </p><canvas id="chart6"></canvas><h4>8. Temperature in the Year 2009.</h4><p> In the year 2009’s September month the average temperature goes maximum up to 12.8
  ℃ while it goes down to 0.0 ℃ in just a span of 25 days. </p><canvas id="chart7"></canvas><h4>9. Temperature in the Year 2012.</h4><p> In the year 2012’s September month the average temperature goes maximum up to 9.7
  ℃ while it goes down to 1.1 ℃ in just a span of 25 days. </p><canvas id="chart8"></canvas><h4>10. Temperature in the Year 2016.</h4><p> In the year 2016’s September month the average temperature goes maximum up to 7.8
  ℃ while it goes down to 1.1 ℃ in just a span of 25 days. </p><canvas id="chart9"></canvas>` }));
});

const $$file$2 = "/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/course/temp.astro";
const $$url$2 = "/course/temp";

const _page5 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$2,
  default: $$Temp,
  file: $$file$2,
  url: $$url$2
}, Symbol.toStringTag, { value: 'Module' }));

var __freeze$1 = Object.freeze;
var __defProp$1 = Object.defineProperty;
var __template$1 = (cooked, raw) => __freeze$1(__defProp$1(cooked, "raw", { value: __freeze$1(raw || cooked.slice()) }));
var _a$1;
const $$metadata$1 = createMetadata("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/result/[id].astro", { modules: [{ module: $$module1, specifier: "../../layouts/layout.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro$1 = createAstro("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/result/[id].astro", "", "file:///Users/arpanpandey/Mirror/Code/aeromates/as-front/");
const $$id = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$id;
  const id = Astro2.url.pathname.split("/")[2];
  const response = await fetch(
    `https://aeromates.hasura.app/api/rest/get-one?id=${id}`,
    {
      method: "GET",
      headers: {
        "x-hasura-admin-secret": "5skwIxmp5eb1riR4pqY4GeRIDzQz2v4m7BO84tD8PoLhp0YPQuvmAfJ1BLM8gcQy"
      }
    }
  );
  let post = await response.json();
  post = post["quizzes_quizzes_by_pk"];
  let partName = "";
  let score = 0;
  let timestamp = Date.now();
  if (post) {
    partName = post["name"];
    score = post["score"];
    timestamp = post["timestamp"];
    Astro2.cookies.set("score", score.toString());
  }
  return renderTemplate(_a$1 || (_a$1 = __template$1(["", '\n<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>\n<script>\n    let allcooks = document.cookie.split(";");\n    let score = 0;\n    for (let i = 0; i < allcooks.length; i++) {\n      let cook = allcooks[i].split("=");\n      if (cook[0].trim() === "score") {\n        score = parseInt(cook[1]);\n      }\n    }\n  const data = {\n    labels: ["Incorrect", "Correct"],\n    datasets: [\n      {\n        label: "My First Dataset",\n        data: [score, 5 - score],\n        backgroundColor: [\n          "rgb(255, 99, 132)",\n          "rgb(54, 162, 235)",\n        ],\n        hoverOffset: 2,\n      },\n    ],\n  };\n  const config = {\n    type: "doughnut",\n    data: data,\n  };\n  const scorey = new Chart(document.getElementById("scorey"), config);\n<\/script>'])), renderComponent($$result, "Layout", $$Layout, {}, { "default": () => renderTemplate`${maybeRenderHead($$result)}<h1>${partName}'s quiz report!</h1><h2>Score: ${score}/5 (${score / 5 * 100}%)</h2><p>Attemped on ${timestamp}</p><div style="width: 50%; height: 50%;"> <canvas id="scorey"> </canvas> </div>` }));
});

const $$file$1 = "/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/result/[id].astro";
const $$url$1 = "/result/[id]";

const _page6 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata: $$metadata$1,
  default: $$id,
  file: $$file$1,
  url: $$url$1
}, Symbol.toStringTag, { value: 'Module' }));

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));
var _a;
const $$metadata = createMetadata("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/quiz.astro", { modules: [{ module: $$module1, specifier: "../layouts/layout.astro", assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: /* @__PURE__ */ new Set([]), hoisted: [] });
const $$Astro = createAstro("/@fs/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/quiz.astro", "", "file:///Users/arpanpandey/Mirror/Code/aeromates/as-front/");
const $$Quiz = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Quiz;
  let questions = [
    {
      question: "Which of the following impacts that climate change may have on our health and environment?",
      answers: [
        "Intense Heat Waves",
        "Unbalance Ecosystem",
        "Extreme weather condition",
        "All of the above"
      ],
      correctAnswer: 3
    },
    {
      question: "Where have some of the strongest and earliest impacts of global warming occurred?",
      answers: [
        "Northern Latitude",
        "Southern Latitude",
        "Antarctica",
        "All of the above"
      ],
      correctAnswer: 1
    },
    {
      question: "Which of the following action could you take to help lessen the impact of climate change?",
      answers: [
        "More use of Electric Vehicles",
        "Reducing Food Wasteage",
        "Conserve Water",
        "All of the above"
      ],
      correctAnswer: 3
    },
    {
      question: "Which of the following is not a green house effect gas",
      answers: ["Carbon Dioxide", "Ozone", "Methane", "Nitrogen"],
      correctAnswer: 3
    },
    {
      question: "What is the major effect of climate change in alska?",
      answers: [
        "Increase in Wildfires",
        "Increase in Sea Ice",
        "Decrease in Temperature",
        "All of the above"
      ],
      correctAnswer: 0
    }
  ];
  return renderTemplate(_a || (_a = __template(["", `

<script>
  let questions = [
    {
      question:
        "Which of the following impacts that climate change may have on our health and environment?",
      answers: [
        "Intense Heat Waves",
        "Unbalance Ecosystem",
        "Extreme weather condition",
        "All of the above",
      ],
      correctAnswer: 3,
    },
    {
      question:
        "Where have some of the strongest and earliest impacts of global warming occurred?",
      answers: [
        "Northern Latitude",
        "Southern Latitude",
        "Antarctica",
        "All of the above",
      ],
      correctAnswer: 1,
    },
    {
      question:
        "Which of the following action could you take to help lessen the impact of climate change?",
      answers: [
        "More use of Electric Vehicles",
        "Reducing Food Wasteage",
        "Conserve Water",
        "All of the above",
      ],
      correctAnswer: 3,
    },
    {
      question: "Which of the following is not a green house effect gas",
      answers: ["Carbon Dioxide", "Ozone", "Methane", "Nitrogen"],
      correctAnswer: 3,
    },
    {
      question: "What is the major effect of climate change in alska?",
      answers: [
        "Increase in Wildfires",
        "Increase in Sea Ice",
        "Decrease in Temperature",
        "All of the above",
      ],
      correctAnswer: 0,
    },
  ];
  const form = document.getElementById("quiz-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    let score = 0;
    for (let i = 0; i < questions.length; i++) {
      const answer = document.getElementById("question" + (i + 1)).value;
      if (answer === questions[i].answers[questions[i].correctAnswer]) {
        score++;
      }
    }
    const name = document.getElementById("name").value;
    let result = await fetch("https://aeromates.hasura.app/api/rest/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": "5skwIxmp5eb1riR4pqY4GeRIDzQz2v4m7BO84tD8PoLhp0YPQuvmAfJ1BLM8gcQy",
      },
      body: JSON.stringify({ score: score, name: name }),
    });
    result = await result.json();
    result = result['insert_quizzes_quizzes_one'];
    window.location.href = "/result/" + result.id;


  });
<\/script>`])), renderComponent($$result, "Layout", $$Layout, {}, { "default": () => renderTemplate`${maybeRenderHead($$result)}<div class="question-box container">
    <form id="quiz-form">
        <h2>Your name</h2>
        <input name="name" id="name">
      ${questions.map((question, index) => renderTemplate`<div${addAttribute("question" + (index + 1), "class")} style="padding-bottom: 5%;">
            <h2>${question.question}</h2>
            <div${addAttribute("answers" + (index + 1), "class")}>
              <select${addAttribute("question" + (index + 1), "id")} required style="padding-top: 1%;">
                <option${addAttribute(question.answers[0], "value")} selected>
                  ${question.answers[0]}
                </option>
                <option${addAttribute(question.answers[1], "value")}>
                  ${question.answers[1]}
                </option>
                <option${addAttribute(question.answers[2], "value")}>
                  ${question.answers[2]}
                </option>
                <option${addAttribute(question.answers[3], "value")}>
                  ${question.answers[3]}
                </option>
              </select>
            </div>
          </div>`)}
      <button type="submit" class="btn btn-primary">Submit</button>
    </form>
  </div>` }));
});

const $$file = "/Users/arpanpandey/Mirror/Code/aeromates/as-front/src/pages/quiz.astro";
const $$url = "/quiz";

const _page7 = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  $$metadata,
  default: $$Quiz,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const pageMap = new Map([['src/pages/index.astro', _page0],['src/pages/leaderboard.astro', _page1],['src/pages/credits.astro', _page2],['src/pages/course/index.astro', _page3],['src/pages/course/wildfire.astro', _page4],['src/pages/course/temp.astro', _page5],['src/pages/result/[id].astro', _page6],['src/pages/quiz.astro', _page7],]);
const renderers = [Object.assign({"name":"astro:jsx","serverEntrypoint":"astro/jsx/server.js","jsxImportSource":"astro"}, { ssr: server_default }),];

if (typeof process !== "undefined") {
  if (process.argv.includes("--verbose")) ; else if (process.argv.includes("--silent")) ; else ;
}

const SCRIPT_EXTENSIONS = /* @__PURE__ */ new Set([".js", ".ts"]);
new RegExp(
  `\\.(${Array.from(SCRIPT_EXTENSIONS).map((s) => s.slice(1)).join("|")})($|\\?)`
);

const STYLE_EXTENSIONS = /* @__PURE__ */ new Set([
  ".css",
  ".pcss",
  ".postcss",
  ".scss",
  ".sass",
  ".styl",
  ".stylus",
  ".less"
]);
new RegExp(
  `\\.(${Array.from(STYLE_EXTENSIONS).map((s) => s.slice(1)).join("|")})($|\\?)`
);

function getRouteGenerator(segments, addTrailingSlash) {
  const template = segments.map((segment) => {
    return segment[0].spread ? `/:${segment[0].content.slice(3)}(.*)?` : "/" + segment.map((part) => {
      if (part)
        return part.dynamic ? `:${part.content}` : part.content.normalize().replace(/\?/g, "%3F").replace(/#/g, "%23").replace(/%5B/g, "[").replace(/%5D/g, "]").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("");
  }).join("");
  let trailing = "";
  if (addTrailingSlash === "always" && segments.length) {
    trailing = "/";
  }
  const toPath = compile(template + trailing);
  return toPath;
}

function deserializeRouteData(rawRouteData) {
  return {
    route: rawRouteData.route,
    type: rawRouteData.type,
    pattern: new RegExp(rawRouteData.pattern),
    params: rawRouteData.params,
    component: rawRouteData.component,
    generate: getRouteGenerator(rawRouteData.segments, rawRouteData._meta.trailingSlash),
    pathname: rawRouteData.pathname || void 0,
    segments: rawRouteData.segments
  };
}

function deserializeManifest(serializedManifest) {
  const routes = [];
  for (const serializedRoute of serializedManifest.routes) {
    routes.push({
      ...serializedRoute,
      routeData: deserializeRouteData(serializedRoute.routeData)
    });
    const route = serializedRoute;
    route.routeData = deserializeRouteData(serializedRoute.routeData);
  }
  const assets = new Set(serializedManifest.assets);
  return {
    ...serializedManifest,
    assets,
    routes
  };
}

const _manifest = Object.assign(deserializeManifest({"adapterName":"@astrojs/netlify/functions","routes":[{"file":"","links":["assets/58f8e449.8bdf606b.css"],"scripts":[],"routeData":{"route":"/","type":"page","pattern":"^\\/$","segments":[],"params":[],"component":"src/pages/index.astro","pathname":"/","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/58f8e449.8bdf606b.css"],"scripts":[],"routeData":{"route":"/leaderboard","type":"page","pattern":"^\\/leaderboard\\/?$","segments":[[{"content":"leaderboard","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/leaderboard.astro","pathname":"/leaderboard","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/58f8e449.8bdf606b.css"],"scripts":[],"routeData":{"route":"/credits","type":"page","pattern":"^\\/credits\\/?$","segments":[[{"content":"credits","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/credits.astro","pathname":"/credits","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/58f8e449.8bdf606b.css"],"scripts":[],"routeData":{"route":"/course","type":"page","pattern":"^\\/course\\/?$","segments":[[{"content":"course","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/course/index.astro","pathname":"/course","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/58f8e449.8bdf606b.css"],"scripts":[],"routeData":{"route":"/course/wildfire","type":"page","pattern":"^\\/course\\/wildfire\\/?$","segments":[[{"content":"course","dynamic":false,"spread":false}],[{"content":"wildfire","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/course/wildfire.astro","pathname":"/course/wildfire","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/58f8e449.8bdf606b.css"],"scripts":[],"routeData":{"route":"/course/temp","type":"page","pattern":"^\\/course\\/temp\\/?$","segments":[[{"content":"course","dynamic":false,"spread":false}],[{"content":"temp","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/course/temp.astro","pathname":"/course/temp","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/58f8e449.8bdf606b.css"],"scripts":[],"routeData":{"route":"/result/[id]","type":"page","pattern":"^\\/result\\/([^/]+?)\\/?$","segments":[[{"content":"result","dynamic":false,"spread":false}],[{"content":"id","dynamic":true,"spread":false}]],"params":["id"],"component":"src/pages/result/[id].astro","_meta":{"trailingSlash":"ignore"}}},{"file":"","links":["assets/58f8e449.8bdf606b.css"],"scripts":[],"routeData":{"route":"/quiz","type":"page","pattern":"^\\/quiz\\/?$","segments":[[{"content":"quiz","dynamic":false,"spread":false}]],"params":[],"component":"src/pages/quiz.astro","pathname":"/quiz","_meta":{"trailingSlash":"ignore"}}}],"base":"/","markdown":{"drafts":false,"syntaxHighlight":"shiki","shikiConfig":{"langs":[],"theme":"github-dark","wrap":false},"remarkPlugins":[],"rehypePlugins":[],"remarkRehype":{},"extendDefaultPlugins":false,"isAstroFlavoredMd":false},"pageMap":null,"renderers":[],"entryModules":{"\u0000@astrojs-ssr-virtual-entry":"entry.mjs","astro:scripts/before-hydration.js":""},"assets":["/assets/58f8e449.8bdf606b.css"]}), {
	pageMap: pageMap,
	renderers: renderers
});
const _args = {};

const _exports = adapter.createExports(_manifest, _args);
const handler = _exports['handler'];

const _start = 'start';
if(_start in adapter) {
	adapter[_start](_manifest, _args);
}

export { handler };
