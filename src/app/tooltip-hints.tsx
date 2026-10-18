"use client";

import { useEffect } from "react";

const HINT_TARGETS = [
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='tab']",
  "[role='link']",
  "[data-tip]",
  "label.field",
  ".consent",
  ".feature-cards article",
  ".app-cards article",
  ".stat",
  ".mini-stats > div",
  ".mini-update",
  ".mini-task",
  ".mini-appt",
  ".floating",
  ".note-card",
  ".app-record",
  ".seat-summary",
  ".family-box",
].join(",");

function clean(value: string) {
  return value.replace(/\s+/g, " ").replace(/[→↗✓♡▶✳]+/g, " ").trim();
}

function describeText(element: HTMLElement) {
  const explicit = element.getAttribute("data-tip") || element.getAttribute("title");
  if (explicit) return clean(explicit);

  const label = clean(element.getAttribute("aria-label") || element.innerText || element.textContent || "");
  if (!label) return "";

  if (element.matches("input,select,textarea,label.field,.consent")) {
    const fieldLabel = clean(element.closest("label")?.querySelector("span")?.textContent || element.getAttribute("aria-label") || "");
    if (element.matches(".consent")) return "Review this choice about sharing information with the AI service.";
    return fieldLabel ? `Enter ${fieldLabel.toLowerCase()} here.` : "Enter information for your family space.";
  }
  if (element.matches("a,[role='link']")) return `Open ${label}.`;
  if (element.matches("[role='tab']")) return `Switch to ${label}.`;
  if (element.matches("button,[role='button']")) return `Use this button to ${label.charAt(0).toLowerCase()}${label.slice(1)}.`;

  if (element.matches(".stat")) {
    const title = clean(element.querySelector("small")?.textContent || "Family information");
    const value = clean(element.querySelector("b")?.textContent || "");
    const note = clean(element.querySelector("em")?.textContent || "");
    return `${title}: ${value}${note ? `, ${note.toLowerCase()}` : ""}.`;
  }
  if (element.matches(".mini-stats > div")) {
    const title = clean(element.querySelector("small")?.textContent || "Family information");
    const value = clean(element.querySelector("b")?.textContent || "");
    return value ? `${title}: ${value}.` : `View ${title.toLowerCase()}.`;
  }
  if (element.matches(".app-record")) return "View this saved item in your private family workspace.";

  const heading = clean(element.querySelector("h1,h2,h3,h4,.card-head b,.stat small,.app-panel-head h2")?.textContent || "");
  const supportingText = clean(element.querySelector("p")?.textContent || "");
  if (heading && supportingText) return `${heading}: ${supportingText}`;
  if (heading) return `View ${heading.toLowerCase()} information.`;
  return label;
}

export default function TooltipHints() {
  useEffect(() => {
    let nextId = 0;
    const described = new WeakSet<HTMLElement>();

    const addDescription = (element: HTMLElement, hint: string) => {
      if (!hint || described.has(element)) return;
      described.add(element);
      if (!element.hasAttribute("data-tip")) element.setAttribute("data-tip", hint);

      const id = `carecircle-tooltip-${++nextId}`;
      const description = document.createElement("span");
      description.className = "sr-only";
      description.id = id;
      description.textContent = element.getAttribute("data-tip") || hint;
      element.insertAdjacentElement("afterend", description);

      const previous = element.getAttribute("aria-describedby");
      if (!previous?.split(/\s+/).includes(id)) {
        element.setAttribute("aria-describedby", previous ? `${previous} ${id}` : id);
      }
      element.removeAttribute("title");
    };

    const applyTo = (element: HTMLElement) => {
      if (element.matches("input,select,textarea")) {
        const wrapper = element.closest<HTMLElement>("label");
        if (wrapper) {
          const explicit = element.getAttribute("data-tip") || wrapper.getAttribute("data-tip");
          const fieldLabel = clean(wrapper.querySelector("span")?.textContent || element.getAttribute("aria-label") || "");
          const hint = explicit || (fieldLabel ? `Enter ${fieldLabel.toLowerCase()} here.` : "Enter information for your family space.");
          addDescription(wrapper, hint);
          const describedBy = element.getAttribute("aria-describedby");
          const id = wrapper.getAttribute("aria-describedby");
          if (id && !describedBy?.split(/\s+/).includes(id)) {
            element.setAttribute("aria-describedby", describedBy ? `${describedBy} ${id}` : id);
          }
          return;
        }
      }

      if (!element.matches(HINT_TARGETS) || element.hasAttribute("data-tip")) {
        if (element.matches(HINT_TARGETS) && element.hasAttribute("data-tip")) addDescription(element, describeText(element));
        return;
      }

      const hint = describeText(element);
      if (!hint) return;

      addDescription(element, hint.slice(0, 180));
    };

    const scan = (root: ParentNode) => {
      if (root instanceof HTMLElement) applyTo(root);
      root.querySelectorAll<HTMLElement>(HINT_TARGETS).forEach(applyTo);
    };

    scan(document);
    const observer = new MutationObserver((changes) => {
      for (const change of changes) {
        change.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement) scan(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
