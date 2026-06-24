import { initWbot, removeWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { wbotMessageListener } from "./wbotMessageListener";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import { logger } from "../../utils/logger";

const RECOVERABLE_SESSION_ERRORS = [
  "session closed",
  "err_wapp_not_initialized",
  "typeerror: cannot read property 'sendseen' of undefined"
];

export const StartWhatsAppSessionVerify = async (
  whatsappId: number,
  error: string
): Promise<void> => {
  const errorString = error.toString().toLowerCase();
  if (RECOVERABLE_SESSION_ERRORS.some(err => errorString.includes(err))) {
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
