function element(tag, options = {}, children = []) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = String(options.text);
  for (const [name, value] of Object.entries(options.attributes || {})) {
    node.setAttribute(name, String(value));
  }
  for (const child of children) {
    if (child !== null && child !== undefined) node.append(child);
  }
  return node;
}

function clear(node) {
  node.replaceChildren();
  return node;
}

function messageState(message, kind = "empty") {
  const colors = {
    loading: "text-slate-400",
    empty: "text-slate-500",
    error: "text-red-300 border border-red-800 bg-red-950/40 rounded-lg",
  };
  return element("div", {
    className: `${colors[kind]} text-center py-10 px-4`,
    text: message,
    attributes: { role: kind === "error" ? "alert" : "status" },
  });
}

function renderError(container, error) {
  clear(container).append(messageState(`載入失敗：${error.message}`, "error"));
}

function statusBadgeNode(status) {
  const states = {
    upcoming: ["未開賽", "bg-blue-600"],
    in_progress: ["進行中", "bg-green-500"],
    finished: ["已結束", "bg-slate-600"],
  };
  const [label, color] = states[status] || ["狀態不明", "bg-red-600"];
  return element("span", {
    className: `text-xs text-white px-2 py-0.5 rounded-full ${color}`,
    text: label,
  });
}

function tableCell(value) {
  if (value instanceof Node) return value;
  if (value && typeof value === "object" && "content" in value) {
    const cell = element("td", { className: value.className || "px-3 py-2.5" });
    if (value.content instanceof Node) cell.append(value.content);
    else cell.textContent = value.content ?? "—";
    return cell;
  }
  return element("td", { className: "px-3 py-2.5", text: value ?? "—" });
}

function createTable(headers, rows) {
  const table = element("table", { className: "w-full text-sm" });
  const head = element("thead");
  head.append(
    element(
      "tr",
      { className: "bg-slate-700 text-slate-300 text-left" },
      headers.map((header) =>
        element("th", { className: "px-3 py-3", text: header }),
      ),
    ),
  );
  const body = element("tbody");
  rows.forEach((cells, index) => {
    body.append(
      element(
        "tr",
        {
          className: `${index % 2 ? "bg-slate-750" : ""} border-t border-slate-700/50`,
        },
        cells.map(tableCell),
      ),
    );
  });
  table.append(head, body);
  return table;
}
