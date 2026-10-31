document.getElementById("recover").onclick = () => {
  const result = document.getElementById("result");
  try {
    const raw = localStorage.getItem("scanianWebsiteDraft:v1");
    if (!raw) {
      result.textContent =
        "No draft was found in this browser. If you edited in another browser, open this page there.";
      return;
    }
    const draft = JSON.parse(raw);
    if (!draft.base || !draft.local)
      throw Error("The saved draft has an unknown format.");
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(draft, null, 2) + "\n"], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "bridge-old-browser-draft.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    result.textContent =
      "The draft was downloaded. The browser copy was not changed or removed.";
  } catch (e) {
    result.textContent = e.message;
  }
};
