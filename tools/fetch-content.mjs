#!/usr/bin/env node
/**
 * Fenix Ninja — generador de contenidos
 *
 * Extrae el contenido de las páginas de fenixbinario.com y produce los
 * guiones que reproducen los comandos #cv, #robot y #reptile.
 *
 *   node tools/fetch-content.mjs
 *
 * Sin dependencias: parser HTML propio y fetch nativo de Node 18+.
 * La salida es determinista y se versiona en data/*.json, de modo que el
 * sitio no depende de la red en tiempo de ejecución.
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ===== Parser HTML mínimo ===== //

const VOID_TAGS = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr"
]);

const TAG_RE = new RegExp(
    "<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]]>|<!doctype[^>]*>" +
    "|</([a-zA-Z][\\w:-]*)\\s*>" +
    "|<([a-zA-Z][\\w:-]*)((?:\\s+[^\\s/>\"'=]+(?:\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s\">]+))?)*)\\s*(\\/?)>",
    "gi"
);

function parseAttrs(raw) {
    const attrs = {};
    const re = /([^\s/>"'=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+)))?/g;
    let m;
    while ((m = re.exec(raw || ""))) {
        attrs[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? "";
    }
    return attrs;
}

function parseHTML(html) {
    const root = { tag: "#root", attrs: {}, children: [], parent: null };
    const stack = [root];
    let last = 0;
    let m;

    const pushText = (text) => {
        if (!text || !text.trim()) return;
        stack[stack.length - 1].children.push({
            tag: "#text",
            text,
            attrs: {},
            children: [],
            parent: stack[stack.length - 1]
        });
    };

    while ((m = TAG_RE.exec(html))) {
        pushText(html.slice(last, m.index));
        last = TAG_RE.lastIndex;

        if (m[0].startsWith("<!")) continue;

        if (m[1]) {
            const name = m[1].toLowerCase();
            for (let i = stack.length - 1; i > 0; i--) {
                if (stack[i].tag === name) {
                    stack.length = i;
                    break;
                }
            }
            continue;
        }

        const name = m[2].toLowerCase();
        const node = {
            tag: name,
            attrs: parseAttrs(m[3]),
            children: [],
            parent: stack[stack.length - 1]
        };
        stack[stack.length - 1].children.push(node);

        if (!VOID_TAGS.has(name) && m[4] !== "/") stack.push(node);
    }

    pushText(html.slice(last));
    return root;
}

// ===== Utilidades del árbol ===== //

const decodeEntities = (value) => value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&copy;/g, "©")
    .replace(/&middot;/g, "·")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const collapse = (value) => decodeEntities(value).replace(/\s+/g, " ").trim();

function textOf(node) {
    if (!node) return "";
    if (node.tag === "#text") return node.text;
    return node.children.map(textOf).join(" ");
}

function classes(node) {
    return (node.attrs.class || "").split(/\s+/).filter(Boolean);
}

function findAll(node, predicate, out = []) {
    for (const child of node.children) {
        if (predicate(child)) out.push(child);
        findAll(child, predicate, out);
    }
    return out;
}

function findFirst(node, predicate) {
    return findAll(node, predicate)[0] || null;
}

function closest(node, predicate) {
    let current = node;
    while (current) {
        if (predicate(current)) return current;
        current = current.parent;
    }
    return null;
}

const isHeading = (node) => /^h[1-6]$/.test(node.tag);

// ===== Extracción de bloques ===== //

function extractBlocks(root) {
    const blocks = [];

    const collectImages = (node, into) => {
        for (const child of node.children) {
            if (child.tag === "img") {
                into.push({ src: child.attrs.src || "", alt: child.attrs.alt || "" });
            } else {
                collectImages(child, into);
            }
        }
        return into;
    };

    (function walk(node) {
        for (const child of node.children) {
            if (isHeading(child)) {
                const text = collapse(textOf(child));
                if (text) blocks.push({ type: "heading", level: Number(child.tag[1]), text });
                continue;
            }

            if (child.tag === "p") {
                const text = collapse(textOf(child));
                if (text) blocks.push({ type: "paragraph", text });
                collectImages(child, []).forEach((img) => blocks.push({ type: "image", ...img }));
                continue;
            }

            if (child.tag === "ul" || child.tag === "ol") {
                const items = child.children
                    .filter((li) => li.tag === "li")
                    .map((li) => collapse(textOf(li)))
                    .filter(Boolean);
                if (items.length) blocks.push({ type: "list", items });
                continue;
            }

            if (child.tag === "img") {
                blocks.push({ type: "image", src: child.attrs.src || "", alt: child.attrs.alt || "" });
                continue;
            }

            if (child.tag === "a") {
                const text = collapse(textOf(child));
                if (text) blocks.push({ type: "link", text, href: child.attrs.href || "" });
                continue;
            }

            walk(child);
        }
    })(root);

    return blocks;
}

// ===== Construcción del guion ===== //

const SOCIAL_HOSTS = [
    "github.com", "t.me", "twitter.com", "linkedin.com", "instagram.com",
    "youtube.com", "cyborgfoundation.org", "fenixbinario.github.io"
];

// Texto de maqueta (créditos del pie) que no debe entrar en el guion.
const BOILERPLATE = [
    /powered by beautiful jekyll/i,
    /f€n1x/i,
    /all rights reserved/i
];

const isBoilerplate = (value) => BOILERPLATE.some((pattern) => pattern.test(value));

// Recursos decorativos del tema (avatar, reloj, botón "subir"): no son
// contenido del CV ni de los proyectos.
const DECORATIVE_ASSETS = new Set([
    "avatar-fenix-ico.png",
    "load.gif",
    "load-time.gif",
    "cv-up.gif"
]);

const isDecorative = (src) => {
    const name = src.split("/").pop().split("?")[0];
    return DECORATIVE_ASSETS.has(name);
};

function buildDeck({ id, command, title, subtitle, source, blocks, leadParagraph }) {
    const slides = [];
    const links = [];

    let sectionTitle = "";
    let sectionLevel = 0;
    let paragraphs = [];
    let bullets = [];
    let images = [];

    const flush = () => {
        const body = paragraphs.join("\n\n");
        const caption = sectionTitle || "";

        if (images.length) {
            images.forEach((image, index) => {
                slides.push({
                    kind: "media",
                    src: image.src,
                    title: sectionTitle,
                    caption: image.alt && image.alt !== "my-evolution" ? image.alt : caption,
                    body: index === 0 ? body : "",
                    live: /\.gif($|\?)/i.test(image.src)
                });
            });
        } else if (body) {
            slides.push({ kind: "section", title: caption, body });
        }

        if (bullets.length) {
            slides.push({ kind: "bullets", title: caption, items: bullets.flat() });
        }

        paragraphs = [];
        bullets = [];
        images = [];
    };

    blocks.forEach((block) => {
        switch (block.type) {
            case "heading": {
                flush();
                sectionTitle = block.text;
                sectionLevel = block.level;
                break;
            }
            case "paragraph": {
                if (!isBoilerplate(block.text)) paragraphs.push(block.text);
                break;
            }
            case "list": {
                bullets.push(block.items);
                break;
            }
            case "image": {
                if (!isDecorative(block.src)) images.push(block);
                break;
            }
            case "link": {
                links.push({ text: block.text, url: block.href });
                break;
            }
        }
    });
    flush();

    const deck = {
        id,
        command,
        title,
        subtitle,
        source,
        slides: [
            { kind: "title", text: title, subtitle: leadParagraph || subtitle },
            ...slides
        ]
    };

    // Slide final de enlaces relevantes (redes y proyectos).
    const relevant = links.filter((link) => {
        if (!link.url) return false;
        if (link.url.startsWith("#")) return false;
        if (/^mailto:/i.test(link.url)) return true;
        return SOCIAL_HOSTS.some((host) => link.url.includes(host));
    });

    const seen = new Set();
    const unique = relevant.filter((link) => {
        const key = `${link.text}|${link.url}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    if (unique.length) {
        deck.slides.push({ kind: "links", title: "Enlaces", items: unique });
    }

    return deck;
}

// ===== Fuentes ===== //

const SOURCES = {
    cv: {
        id: "cv",
        command: "/cv",
        url: "https://fenixbinario.com/aboutme/",
        title: "CV",
        subtitle: "Fénix Ríos — Ingeniería de software, IoT y robótica",
        pickRoot(doc) {
            const anchor = findFirst(doc, (node) => node.attrs.id === "cv");
            const column = anchor && closest(anchor, (node) => classes(node).includes("col-xl-8"));
            return column || findFirst(doc, (node) => node.tag === "article") || doc;
        }
    },
    robot: {
        id: "robot",
        command: "/robot",
        url: "https://fenixbinario.com/2017-06-30-Nibble/",
        title: "Nibble",
        subtitle: "Robot fácil de montar y replicar",
        pickRoot(doc) {
            return findFirst(doc, (node) => node.tag === "article")
                || findFirst(doc, (node) => classes(node).includes("post-content"))
                || doc;
        }
    },
    reptile: {
        id: "reptile",
        command: "/reptile",
        url: "https://fenixbinario.com/2017-02-26-Nosystat/",
        title: "Nosystat",
        subtitle: "Dispositivo IoT para microclimas de terrario",
        pickRoot(doc) {
            return findFirst(doc, (node) => node.tag === "article")
                || findFirst(doc, (node) => classes(node).includes("post-content"))
                || doc;
        }
    }
};

async function fetchHTML(url) {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "fenix-ninja-content-builder/1.0",
            "Accept": "text/html"
        }
    });
    if (!response.ok) throw new Error(`${url} -> HTTP ${response.status}`);
    return response.text();
}

function absolutize(blocks, base) {
    const resolveURL = (value) => {
        if (!value) return "";
        try {
            return new URL(value, base).href;
        } catch {
            return value;
        }
    };

    return blocks.map((block) => {
        if (block.type === "image") return { ...block, src: resolveURL(block.src) };
        if (block.type === "link") return { ...block, href: resolveURL(block.href) };
        return block;
    });
}

// ===== Ejecución ===== //

async function main() {
    await mkdir(resolve(ROOT, "data"), { recursive: true });

    for (const source of Object.values(SOURCES)) {
        const html = await fetchHTML(source.url);
        const doc = parseHTML(html);
        const root = source.pickRoot(doc);
        const blocks = absolutize(extractBlocks(root), source.url);

        const lead = blocks.find((block) => block.type === "paragraph");
        const deck = buildDeck({
            id: source.id,
            command: source.command,
            title: source.title,
            subtitle: source.subtitle,
            source: source.url,
            blocks,
            leadParagraph: lead ? lead.text : source.subtitle
        });

        const target = resolve(ROOT, "data", `${source.id}.json`);
        await writeFile(target, `${JSON.stringify(deck, null, 2)}\n`, "utf8");

        const media = deck.slides.filter((slide) => slide.kind === "media").length;
        console.log(
            `${source.id.padEnd(8)} -> ${deck.slides.length} diapositivas ` +
            `(${media} con medio) :: ${target.replace(`${ROOT}/`, "")}`
        );
    }
}

main().catch((error) => {
    console.error("Fallo la generación de contenidos:", error);
    process.exit(1);
});
