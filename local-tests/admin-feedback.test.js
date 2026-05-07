const assert = require("node:assert/strict");
const test = require("node:test");

const {
  normalizeDialogOptions,
  normalizeToastOptions,
  showConfirmDialog,
  showErrorToast,
  showSuccessToast,
} = require("../public/assets/js/admin-feedback");

test("normalizeToastOptions applies defaults and supported tones", () => {
  const toast = normalizeToastOptions({
    message: "Word saved.",
    tone: "success",
    duration: 1800,
  });

  assert.match(toast.id, /^toast-/);
  assert.equal(toast.message, "Word saved.");
  assert.equal(toast.tone, "success");
  assert.equal(toast.duration, 1800);

  const fallbackToast = normalizeToastOptions({
    message: "Fallback",
    tone: "weird",
    duration: -10,
  });

  assert.equal(fallbackToast.tone, "info");
  assert.equal(fallbackToast.duration, 4000);
});

test("normalizeDialogOptions applies safe defaults", () => {
  assert.deepEqual(
    normalizeDialogOptions({
      title: " Delete tag ",
      message: " Tag is in use? ",
      confirmText: " Delete ",
      cancelText: " Cancel ",
      tone: "danger",
    }),
    {
      title: "Delete tag",
      message: "Tag is in use?",
      confirmText: "Delete",
      cancelText: "Cancel",
      tone: "danger",
    },
  );

  assert.deepEqual(
    normalizeDialogOptions({}),
    {
      title: "",
      message: "",
      confirmText: "OK",
      cancelText: "Cancel",
      tone: "default",
    },
  );
});

test("showConfirmDialog falls back to native confirm when no document exists", async () => {
  let capturedMessage = "";

  const result = await showConfirmDialog(
    {
      title: "Delete",
      message: "Delete this asset?",
    },
    {
      confirm(message) {
        capturedMessage = message;
        return true;
      },
    },
  );

  assert.equal(result, true);
  assert.equal(capturedMessage, "Delete this asset?");
});

test("toast helpers still return normalized payloads without a DOM", () => {
  const fakeRoot = { setTimeout() {} };
  const successToast = showSuccessToast("Saved.", {}, fakeRoot);
  const errorToast = showErrorToast("Failed.", {}, fakeRoot);

  assert.equal(successToast.message, "Saved.");
  assert.equal(successToast.tone, "success");
  assert.equal(errorToast.message, "Failed.");
  assert.equal(errorToast.tone, "error");
});
