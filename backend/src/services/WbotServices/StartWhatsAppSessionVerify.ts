import { initWbot, removeWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { wbotMessageListener } from "./wbotMessageListener";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import { logger } from "../../utils/logger";

const restartingSessions = new Set<number>();

const shouldRestartSession = (error: unknown): boolean => {
  const errorString = String(error).toLowerCase();

  return (
    errorString.includes("session closed") ||
    errorString.includes("err_wapp_not_initialized") ||
    errorString.includes("cannot read property 'sendseen' of undefined") ||
    errorString.includes("cannot read properties of undefined (reading 'sendseen')")
  );
};

export const StartWhatsAppSessionVerify = async (
  whatsappId: number,
  error: unknown
): Promise<void> => {
  if (!shouldRestartSession(error) || restartingSessions.has(whatsappId)) {
    return;
  }

  restartingSessions.add(whatsappId);

  try {
    const whatsapp = await Whatsapp.findByPk(whatsappId);

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
  } finally {
    restartingSessions.delete(whatsappId);
  }
};
