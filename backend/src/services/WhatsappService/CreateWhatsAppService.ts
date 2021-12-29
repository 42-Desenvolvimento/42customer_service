import AppError from "../../errors/AppError";
import { getIO } from "../../libs/socket";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  name: string;
  status?: string;
  isDefault?: boolean;
  tenantId: string | number;
  tokenTelegram?: string;
  instagramUser?: string;
  instagramKey?: string;
  wabaBSP?: string;
  wabaApiKey?: string;
  type: "waba" | "instagram" | "telegram" | "whatsapp";
}

interface Response {
  whatsapp: Whatsapp;
  oldDefaultWhatsapp: Whatsapp | null;
}

const CreateWhatsAppService = async ({
  name,
  status = "DISCONNECTED",
  tenantId,
  tokenTelegram,
  instagramUser,
  instagramKey,
  type,
  wabaBSP,
  wabaApiKey,
  isDefault = false
}: Request): Promise<Response> => {
  if (type === "waba" && (!wabaApiKey || !wabaBSP)) {
    throw new AppError("WABA: favor informar o Token e a BSP");
  }

  if (type === "instagram" && !instagramUser) {
    throw new AppError(
      "Instagram: favor informar o Usuário e senha corretamente."
    );
  }

  if (type === "telegram" && !tokenTelegram) {
    throw new AppError("Telegram: favor informar o Token.");
  }

  const whatsappFound = await Whatsapp.findOne({
    where: { tenantId, isDefault: true }
  });

  if (!whatsappFound) {
    isDefault = !whatsappFound;
  }

  if (isDefault) {
    if (whatsappFound) {
      await whatsappFound.update({ isDefault: false });
    }
  }

  const whatsapp = await Whatsapp.create({
    name,
    status,
    isDefault,
    tenantId,
    tokenTelegram,
    instagramUser,
    instagramKey,
    type,
    wabaBSP,
    wabaApiKey
  });

  const io = getIO();
  io.emit(`${tenantId}:whatsapp`, {
    action: "update",
    whatsapp
  });

  return { whatsapp, oldDefaultWhatsapp: whatsappFound };
};

export default CreateWhatsAppService;
