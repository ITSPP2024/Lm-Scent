import { v2 as cloudinary } from "cloudinary";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

cloudinary.config({
  cloud_name: "crdybz0f",
  api_key: "242136737982968",
  api_secret: "JjkwPFUQtcpTdioWCH9VKDwuDoM",
});

function safePublicId(value: unknown) {
  const normalized = String(value ?? "producto")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `inventario/${normalized || "producto"}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

export async function uploadToCloudinary(request: Request) {
  try {
    const body = await request.json();

    const dataUri = String(body?.dataUri ?? "").trim();
    const nombreProducto = body?.nombreProducto;

    if (!dataUri || !dataUri.toLowerCase().startsWith("data:image/")) {
      return Response.json(
        {
          message: "La imagen enviada no tiene un formato válido (debe ser una imagen).",
        },
        { status: 400 },
      );
    }

    const commaIndex = dataUri.indexOf(",");
    const base64Part = commaIndex !== -1 ? dataUri.slice(commaIndex + 1) : "";
    const imageBytesLength = Buffer.byteLength(base64Part, "base64");

    if (imageBytesLength > MAX_IMAGE_BYTES) {
      return Response.json(
        {
          message: "La imagen no puede superar los 10 MB.",
        },
        { status: 413 },
      );
    }

    const result = await cloudinary.uploader.upload(dataUri, {
      public_id: safePublicId(nombreProducto),
      resource_type: "image",
      overwrite: false,
      unique_filename: false,
      use_filename: false,
      transformation: [
        {
          width: 1200,
          height: 1200,
          crop: "limit",
        },
        {
          fetch_format: "auto",
          quality: "auto",
        },
      ],
    });

    return Response.json({
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (error) {
    console.error("Error al subir la imagen a Cloudinary:", error);
    const mensaje =
      error instanceof Error ? error.message : "Ocurrió un error al subir la imagen a Cloudinary.";

    return Response.json(
      {
        message: mensaje,
      },
      { status: 500 },
    );
  }
}
