import { initWbot, removeWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { wbotMessageListener } from "./wbotMessageListener";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import { logger } from "../../utils/logger";

export const StartWhatsAppSessionVerify = async (
  whatsappId: number,
  error: unknown
): Promise<void> => {
  const errorString = String(error).toLowerCase();
  const isSendSeenDisconnected =
    errorString.includes("sendseen") && errorString.includes("undefined");
  if (
    errorString.includes("session closed") ||
    errorString.includes("err_wapp_not_initialized") ||
    isSendSeenDisconnected
  ) {
    const whatsapp = await Whatsapp.findByPk(whatsappId);
    try {
      if (whatsapp) {
        await whatsapp.update({ status: "OPENING" });
        const io = getIO();
        io.emit(`${whatsapp?.tenantId}:whatsappSession`, {
          action: "update",
          session: whatsapp
        });
        await removeWbot(whatsapp.id);
        const wbot = await initWbot(whatsapp);
        wbotMessageListener(wbot);
        wbotMonitor(wbot, whatsapp);
      }
    } catch (err) {
      logger.error(err);
    }
  }
};
