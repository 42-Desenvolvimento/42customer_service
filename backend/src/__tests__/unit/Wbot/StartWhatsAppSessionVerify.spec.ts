import { initWbot, removeWbot } from "../../../libs/wbot";
import { getIO } from "../../../libs/socket";
import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn()
}));

jest.mock("../../../models/Whatsapp", () => ({
  findByPk: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

describe("StartWhatsAppSessionVerify", () => {
  const wbot = { id: 7 };

  const buildWhatsapp = () => ({
    id: 7,
    tenantId: 3,
    update: jest.fn().mockResolvedValue(undefined)
  });

  beforeEach(() => {
    (getIO as jest.Mock).mockReturnValue({ emit: jest.fn() });
    (initWbot as jest.Mock).mockResolvedValue(wbot);
  });

  it("removes the stale session before initializing a recovered one", async () => {
    const whatsapp = buildWhatsapp();
    const callOrder: string[] = [];

    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    (removeWbot as jest.Mock).mockImplementation(() => {
      callOrder.push("remove");
    });
    (initWbot as jest.Mock).mockImplementation(async () => {
      callOrder.push("init");
      return wbot;
    });

    await StartWhatsAppSessionVerify(
      7,
      new Error("TypeError: Cannot read property 'sendSeen' of undefined")
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(7);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(callOrder).toEqual(["remove", "init"]);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("deduplicates concurrent recoveries for the same whatsapp", async () => {
    const whatsapp = buildWhatsapp();
    let resolveLookup: (value: unknown) => void = () => {};
    const lookupPromise = new Promise(resolve => {
      resolveLookup = resolve;
    });

    (Whatsapp.findByPk as jest.Mock).mockReturnValue(lookupPromise);

    const firstRecovery = StartWhatsAppSessionVerify(
      7,
      "ERR_WAPP_NOT_INITIALIZED"
    );
    const secondRecovery = StartWhatsAppSessionVerify(7, "session closed");

    expect(Whatsapp.findByPk).toHaveBeenCalledTimes(1);

    resolveLookup(whatsapp);
    await Promise.all([firstRecovery, secondRecovery]);

    expect(removeWbot).toHaveBeenCalledTimes(1);
    expect(initWbot).toHaveBeenCalledTimes(1);

    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    await StartWhatsAppSessionVerify(7, "session closed");

    expect(Whatsapp.findByPk).toHaveBeenCalledTimes(2);
    expect(initWbot).toHaveBeenCalledTimes(2);
  });

  it("ignores errors that do not indicate a disconnected session", async () => {
    await StartWhatsAppSessionVerify(7, "invalid number");

    expect(Whatsapp.findByPk).not.toHaveBeenCalled();
    expect(removeWbot).not.toHaveBeenCalled();
    expect(initWbot).not.toHaveBeenCalled();
  });
});
