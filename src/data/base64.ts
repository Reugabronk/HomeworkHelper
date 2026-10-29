// Omzetten tussen binaire gegevens en base64 (werkt in de browser en in Node).

export function naarBase64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let binair = '';
  const blok = 0x8000;
  for (let i = 0; i < bytes.length; i += blok) {
    binair += String.fromCharCode(...bytes.subarray(i, i + blok));
  }
  return btoa(binair);
}

export function vanBase64(base64: string): ArrayBuffer {
  const binair = atob(base64.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binair.length);
  for (let i = 0; i < binair.length; i++) bytes[i] = binair.charCodeAt(i);
  return bytes.buffer;
}
