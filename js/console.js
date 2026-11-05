(function () {
    'use strict';

    // ===== IDENTIFICADORES ===== //
    const IDS = {
        console: "fnx-console",
        panel: "fnx-console-panel",
        toggle: "fnx-console-toggle",
        list: "fnx-command-list",
        count: "fnx-console-count",
        input: "ai-input",
        upload: "ai-upload",
        uploadButton: "fnx-upload-button"
    };

    const state = {
        commands: [],
        visible: [],
        activeIndex: -1,
        history: [],
        historyIndex: -1,
        open: true,
        presentation: null
    };

    const el = {};

    function byId(id) {
        return document.getElementById(id);
    }

    function cacheElements() {
        el.console = byId(IDS.console);
        el.panel = byId(IDS.panel);
        el.toggle = byId(IDS.toggle);
        el.list = byId(IDS.list);
        el.count = byId(IDS.count);
        el.input = byId(IDS.input);
        el.upload = byId(IDS.upload);
        el.uploadButton = byId(IDS.uploadButton);
    }

    // ===== AVISOS (toast propio; sustituye a window.alert) ===== //
    function toastStack() {
        let stack = document.querySelector(".fnx-toast-stack");
        if (!stack) {
            stack = document.createElement("div");
            stack.className = "fnx-toast-stack";
            stack.setAttribute("role", "status");
            stack.setAttribute("aria-live", "polite");
            document.body.appendChild(stack);
        }
        return stack;
    }

    function toast(message, { tone = "default", code = "" } = {}) {
        const node = document.createElement("div");
        node.className = "fnx-toast";
        node.dataset.tone = tone;

        if (code) {
            const codeNode = document.createElement("span");
            codeNode.className = "fnx-toast__code";
            codeNode.textContent = code;
            node.appendChild(codeNode);
        }

        const text = document.createElement("span");
        text.textContent = message;
        node.appendChild(text);

        toastStack().appendChild(node);
        requestAnimationFrame(() => {
            node.dataset.state = "visible";
        });

        setTimeout(() => {
            node.dataset.state = "hidden";
            setTimeout(() => {
                if (node.parentNode) node.parentNode.removeChild(node);
            }, 340);
        }, 2800);
    }

    // ===== PALETA DE COMANDOS ===== //
    function matches(command, query) {
        if (!query) return true;
        const needle = query.toLowerCase();
        return (
            command.id.toLowerCase().indexOf(needle) !== -1 ||
            command.description.toLowerCase().indexOf(needle) !== -1
        );
    }

    function renderList() {
        if (!el.list || !el.input) return;

        const query = el.input.value.trim();
        state.visible = state.commands.filter((command) => matches(command, query));
        state.activeIndex = -1;

        el.list.textContent = "";

        if (!state.visible.length) {
            const empty = document.createElement("li");
            empty.className = "fnx-console__empty";
            empty.textContent = "Ningún comando coincide con la búsqueda";
            el.list.appendChild(empty);
        } else {
            state.visible.forEach((command, index) => {
                const item = document.createElement("li");
                item.className = "fnx-console__option";
                item.id = `fnx-command-${index}`;
                item.setAttribute("role", "option");
                item.setAttribute("aria-selected", "false");

                const id = document.createElement("span");
                id.className = "fnx-console__option-id";
                id.textContent = command.id;

                const description = document.createElement("span");
                description.className = "fnx-console__option-desc";
                description.textContent = command.description;

                item.appendChild(id);
                item.appendChild(description);

                item.addEventListener("mouseenter", () => setActive(index));
                item.addEventListener("mousedown", (event) => {
                    // Evita que el input pierda el foco antes del clic.
                    event.preventDefault();
                });
                item.addEventListener("click", () => {
                    el.input.value = command.id;
                    execute(command.id);
                    el.input.focus();
                });

                el.list.appendChild(item);
            });
        }

        el.list.hidden = false;
        el.input.setAttribute("aria-expanded", "true");
        updateCount();
    }

    function hideList() {
        if (!el.list || !el.input) return;
        el.list.hidden = true;
        el.input.setAttribute("aria-expanded", "false");
        el.input.removeAttribute("aria-activedescendant");
        state.activeIndex = -1;
    }

    function setActive(index) {
        if (!el.list) return;

        const options = el.list.querySelectorAll(".fnx-console__option");
        options.forEach((option) => option.setAttribute("aria-selected", "false"));

        if (index < 0 || index >= options.length) {
            state.activeIndex = -1;
            if (el.input) el.input.removeAttribute("aria-activedescendant");
            return;
        }

        const option = options[index];
        option.setAttribute("aria-selected", "true");
        state.activeIndex = index;
        if (el.input) el.input.setAttribute("aria-activedescendant", option.id);
        option.scrollIntoView({ block: "nearest" });
    }

    function moveActive(delta) {
        if (!state.visible.length) return;
        const next = state.activeIndex + delta;
        setActive(next < 0 ? state.visible.length - 1 : next % state.visible.length);
    }

    // ===== HISTORIAL ===== //
    function pushHistory(value) {
        if (!value) return;
        state.history = state.history.filter((entry) => entry !== value);
        state.history.push(value);
        if (state.history.length > 50) state.history.shift();
        state.historyIndex = state.history.length;
    }

    function historyStep(delta) {
        if (!state.history.length) return;

        const index = state.historyIndex + delta;
        if (index < 0) return;

        state.historyIndex = index;
        const value = state.history[index];
        el.input.value = value === undefined ? "" : value;
        renderList();
    }

    // ===== EJECUCIÓN ===== //
    function execute(value) {
        if (!window.AICanvas || typeof window.AICanvas.execute !== "function") {
            toast("El motor del lienzo no está disponible", { tone: "danger" });
            return;
        }
        window.AICanvas.execute(value);
    }

    // ===== CONTADOR / ESTADO ===== //
    function updateCount() {
        if (!el.count) return;

        if (state.presentation) {
            el.count.textContent = `${state.presentation.deck} ${state.presentation.index + 1}/${state.presentation.total}`;
            return;
        }

        const total = state.commands.length;
        const filtered = state.visible.length;
        el.count.textContent = filtered === total ? `${total} comandos` : `${filtered}/${total} comandos`;
    }

    // ===== TOGGLE ===== //
    function setOpen(open) {
        state.open = open;
        if (!el.console) return;

        el.console.dataset.open = open ? "true" : "false";
        if (el.toggle) {
            el.toggle.setAttribute("aria-expanded", open ? "true" : "false");
            el.toggle.setAttribute(
                "aria-label",
                open ? "Ocultar la consola de comandos" : "Mostrar la consola de comandos"
            );
        }

        if (open) {
            if (el.input) el.input.focus();
        } else {
            hideList();
        }
    }

    // ===== EVENTOS ===== //
    function handleInputKeydown(event) {
        const empty = el.input.value.trim() === "";

        switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                if (empty && state.history.length) historyStep(-1);
                else moveActive(1);
                break;

            case "ArrowUp":
                event.preventDefault();
                if (empty && state.history.length) historyStep(1);
                else moveActive(-1);
                break;

            case "Tab":
                if (state.activeIndex >= 0 && state.visible[state.activeIndex]) {
                    event.preventDefault();
                    event.stopPropagation();
                    el.input.value = state.visible[state.activeIndex].id;
                    renderList();
                }
                break;

            case "Escape":
                if (!el.list.hidden) {
                    event.preventDefault();
                    event.stopPropagation();
                    hideList();
                }
                break;

            case "Enter": {
                // Si hay una opción resaltada se ejecuta esa; si no, se delega
                // en el motor (que ya gestiona el envío del evento fnx:command).
                if (state.activeIndex >= 0 && state.visible[state.activeIndex]) {
                    event.preventDefault();
                    event.stopPropagation();
                    const command = state.visible[state.activeIndex].id;
                    el.input.value = "";
                    execute(command);
                    renderList();
                }
                break;
            }

            default:
                break;
        }
    }

    function handleGlobalKeydown(event) {
        if (event.key !== "`" && event.key !== "~") return;

        const target = event.target;
        const tag = target && target.tagName ? target.tagName.toLowerCase() : "";
        if (tag === "input" || tag === "textarea" || (target && target.isContentEditable)) return;

        event.preventDefault();
        setOpen(!state.open);
    }

    function handleCommandExecuted(event) {
        const { value, matched, command } = event.detail;

        pushHistory(value);
        hideList();

        if (el.input) {
            el.input.value = "";
            renderList();
        }

        if (!value) return;

        if (!matched) {
            if (value.charAt(0) === "#") {
                toast("Comando desconocido", { tone: "danger", code: value });
            } else {
                toast("Renderizado en el lienzo", { code: value });
            }
            return;
        }

        if (command === "#cv" || command === "#robot" || command === "#reptile") {
            toast("Presentación en marcha", { code: command });
        }
    }

    function handlePresentation(event) {
        const detail = event.detail;

        if (detail.state === "start") {
            state.presentation = { deck: detail.deck, index: 0, total: 0 };
            // La paleta se pliega durante la presentación: la consola baja a
            // una sola línea y deja el lienzo al espectador.
            hideList();
            updateCount();
            return;
        }

        if (detail.state === "slide") {
            state.presentation = {
                deck: detail.deck,
                index: detail.index,
                total: detail.total
            };
            updateCount();
            return;
        }

        if (detail.state === "end") {
            state.presentation = null;
            updateCount();
            toast("Presentación finalizada", { code: detail.deck });
            return;
        }

        if (detail.state === "error") {
            state.presentation = null;
            updateCount();
            toast("No se pudo cargar el guion", { tone: "danger", code: detail.deck });
        }
    }

    // ===== ARRANQUE ===== //
    function initConsole() {
        cacheElements();
        if (!el.console || !el.input) return;

        state.commands = (window.AICanvas && window.AICanvas.commands) || [];

        // El motor escucha Enter en fase de burbuja; la consola usa captura
        // para poder completar o redirigir el comando antes.
        el.input.addEventListener("keydown", handleInputKeydown, true);

        el.input.addEventListener("input", () => {
            state.historyIndex = state.history.length;
            renderList();
        });

        // Durante una presentación la consola se queda en una línea: la paleta
        // solo aparece al escribir, para no tapar el contenido.
        el.input.addEventListener("focus", () => {
            if (!state.presentation) renderList();
        });

        el.input.addEventListener("blur", () => {
            setTimeout(() => {
                if (document.activeElement !== el.input) hideList();
            }, 160);
        });

        if (el.toggle) {
            el.toggle.addEventListener("click", () => setOpen(!state.open));
        }

        if (el.uploadButton && el.upload) {
            el.uploadButton.addEventListener("click", () => el.upload.click());
        }

        document.addEventListener("keydown", handleGlobalKeydown);
        document.addEventListener("fnx:command", handleCommandExecuted);
        document.addEventListener("fnx:presentation", handlePresentation);

        setOpen(true);
        renderList();
        updateCount();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initConsole);
    } else {
        initConsole();
    }

    window.FenixConsole = {
        init: initConsole,
        setOpen,
        toast
    };
})();
