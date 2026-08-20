import { initWbot, removeWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { wbotMessageListener } from "./wbotMessageListener";
import { getIO } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import { logger } from "../../utils/logger";

const reconnectingWhatsapps = new Map<number, Promise<void>>();

const shouldRestartSession = (error: unknown): boolean => {
  const errorString = String(error).toLowerCase();
  const sessionClosed = "session closed";
  const sessionDisconnected = "cannot read property 'sendseen' of undefined";
  const wappNotInitialized = "err_wapp_not_initialized";

  return (
    errorString.indexOf(sessionClosed) !== -1 ||
    errorString.indexOf(wappNotInitialized) !== -1 ||
    errorString.indexOf(sessionDisconnected) !== -1
  );
};

export const StartWhatsAppSessionVerify = async (
  whatsappId: number,
  error: unknown
): Promise<void> => {
  if (!shouldRestartSession(error)) return;

  const reconnecting = reconnectingWhatsapps.get(whatsappId);
  if (reconnecting) return reconnecting;

  const reconnect = (async () => {
    try {
      const whatsapp = await Whatsapp.findByPk(whatsappId);
      if (whatsapp) {
        await whatsapp.update({ status: "OPENING" });
        const io = getIO();
        io.emit(`${whatsapp?.tenantId}:whatsappSession`, {
          action: "update",
          session: whatsapp
        });
        removeWbot(whatsappId);
        const wbot = await initWbot(whatsapp);
        wbotMessageListener(wbot);
        wbotMonitor(wbot, whatsapp);
      }
    } catch (err) {
      logger.error(err);
    } finally {
      reconnectingWhatsapps.delete(whatsappId);
    }
  })();

  reconnectingWhatsapps.set(whatsappId, reconnect);
  return reconnect;
};
