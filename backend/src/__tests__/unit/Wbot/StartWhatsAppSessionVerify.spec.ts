import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: jest.fn()
}));

describe("StartWhatsAppSessionVerify", () => {
  const mockedWhatsapp = Whatsapp as unknown as { findByPk: jest.Mock };
  const mockedGetIO = getIO as jest.Mock;
  const mockedInitWbot = initWbot as jest.Mock;
  const mockedRemoveWbot = removeWbot as jest.Mock;
  const mockedWbotMessageListener = wbotMessageListener as jest.Mock;
  const mockedWbotMonitor = wbotMonitor as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    new TypeError("Cannot read properties of undefined (reading 'sendSeen')"),
    "TypeError: Cannot read property 'sendSeen' of undefined"
  ])(
    "removes the stale session before restarting after sendSeen failures",
    async error => {
      const callOrder: string[] = [];
      const whatsapp = {
        id: 7,
        tenantId: 3,
        update: jest.fn().mockResolvedValue(undefined)
      };
      const wbot = { id: 7 };
      const emit = jest.fn();

      mockedWhatsapp.findByPk.mockResolvedValue(whatsapp);
      mockedGetIO.mockReturnValue({ emit });
      mockedRemoveWbot.mockImplementation(async () => {
        callOrder.push("remove");
      });
      mockedInitWbot.mockImplementation(async () => {
        callOrder.push("init");
        return wbot;
      });

      await StartWhatsAppSessionVerify(7, error);

      expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
      expect(emit).toHaveBeenCalledWith("3:whatsappSession", {
        action: "update",
        session: whatsapp
      });
      expect(mockedRemoveWbot).toHaveBeenCalledWith(7);
      expect(mockedInitWbot).toHaveBeenCalledWith(whatsapp);
      expect(callOrder).toEqual(["remove", "init"]);
      expect(mockedWbotMessageListener).toHaveBeenCalledWith(wbot);
      expect(mockedWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
    }
  );
});
