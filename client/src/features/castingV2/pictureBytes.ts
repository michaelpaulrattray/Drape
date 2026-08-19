/**
 * A CHOSEN FILE AS BASE64 — one copy, because two surfaces now send a picture.
 *
 * The makeup read carries its bytes in the request (it looks once and keeps
 * nothing); the attach door carries them to a copy under the Cast's own purge
 * path. Same encoding, same failure, and a second implementation of it would
 * drift on the detail below — which is not obvious and was found the hard way.
 *
 * `FileReader` rather than `arrayBuffer()` + a manual encode: the manual loop
 * blows the stack on a large image through `String.fromCharCode(...bytes)`, and
 * a customer's photograph is exactly the size that finds it.
 */
export function asBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That photo couldn't be read."));
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      const comma = value.indexOf(",");
      resolve(comma >= 0 ? value.slice(comma + 1) : value);
    };
    reader.readAsDataURL(file);
  });
}
