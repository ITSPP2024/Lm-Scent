import { v2 as cloudinary } from "cloudinary";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const DATA_URI_PATTERN =
  /^data:image\/(?:jpeg|jpg|png|webp|gif|avif);base64,([a-zA-Z0-9+/=\s]+)$/;

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

  return `inventario/${normalized || "producto"}-${Date.now()}`;
}

export async function uploadToCloudinary(request: Request) {
  try {
    const body = await request.json();

    const dataUri = String(body?.dataUri ?? "");
    const nombreProducto = body?.nombreProducto;

    const match = dataUri.match(DATA_URI_PATTERN);

    if (!match) {
      return Response.json(
        {
          message: "La imagen enviada no tiene un formato válido.",
        },
        { status: 400 },
      );
    }

    const imageBytes = Buffer.from(
      match[1].replace(/\s/g, ""),
      "base64",
    );

    if (imageBytes.byteLength > MAX_IMAGE_BYTES) {
      return Response.json(
        {
          message: "La imagen no puede superar los 5 MB.",
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
    console.error(
      "Error al subir la imagen a Cloudinary:",
      error,
    );

    return Response.json(
      {
        message:
          "Ocurrió un error al subir la imagen a Cloudinary.",
      },
      { status: 500 },
    );
  }
}