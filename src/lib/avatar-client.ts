export const MAX_AVATAR_INPUT_BYTES = 5_000_000;
export const MAX_AVATAR_DIMENSION = 1024;
const TARGET_AVATAR_BYTES = 1_000_000;

export function scaledAvatarDimensions(width: number, height: number) {
  if (width <= 0 || height <= 0) throw new Error("Dimensões de imagem inválidas.");
  const scale = Math.min(1, MAX_AVATAR_DIMENSION / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível ler a imagem selecionada."));
    };
    image.src = objectUrl;
  });
}

function canvasToWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Não foi possível compactar a imagem.")),
      "image/webp",
      quality,
    );
  });
}

export async function optimizeAvatar(file: File) {
  if (file.size > MAX_AVATAR_INPUT_BYTES) {
    throw new Error("A foto deve ter no máximo 5 MB.");
  }

  const image = await loadImage(file);
  const dimensions = scaledAvatarDimensions(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Não foi possível preparar a imagem.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

  let optimized = await canvasToWebp(canvas, 0.84);
  for (const quality of [0.74, 0.64]) {
    if (optimized.size <= TARGET_AVATAR_BYTES) break;
    optimized = await canvasToWebp(canvas, quality);
  }

  if (optimized.size > MAX_AVATAR_INPUT_BYTES) {
    throw new Error("Não foi possível reduzir a foto para menos de 5 MB.");
  }

  return new File([optimized], "avatar.webp", {
    type: "image/webp",
    lastModified: Date.now(),
  });
}
