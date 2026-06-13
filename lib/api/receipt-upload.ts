export async function receiptFileToDataUrl(file: File): Promise<string> {
  const mime =
    file.type ||
    (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
  if (mime !== "application/pdf" && !mime.startsWith("image/")) {
    throw new Error("Receipt must be an image or PDF");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

export async function readReceiptFromFormData(
  form: FormData
): Promise<string | null> {
  const file = form.get("receipt");
  if (!(file instanceof File) || file.size === 0) return null;
  return receiptFileToDataUrl(file);
}
