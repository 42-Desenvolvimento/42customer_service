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
  const sessionClosed = "session closed";
  const sessionDisconnected =
    "typeerror: cannot read property 'sendseen' of undefined";
  const wappNotInitialized = "err_wapp_not_initialized";
  if (
    errorString.indexOf(sessionClosed) !== -1 ||
    errorString.indexOf(wappNotInitialized) !== -1 ||
    errorString.indexOf(sessionDisconnected) !== -1
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
        removeWbot(whatsapp.id);
        const wbot = await initWbot(whatsapp);
        wbotMessageListener(wbot);
        wbotMonitor(wbot, whatsapp);
      }
    } catch (err) {
      logger.error(err);
    }
  }
};
