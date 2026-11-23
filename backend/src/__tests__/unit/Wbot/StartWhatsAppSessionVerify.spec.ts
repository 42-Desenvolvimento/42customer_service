import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import { wbotMessageListener } from "../../../services/WbotServices/wbotMessageListener";
import wbotMonitor from "../../../services/WbotServices/wbotMonitor";

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

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn()
  }
}));

describe("StartWhatsAppSessionVerify", () => {
  const update = jest.fn();
  const emit = jest.fn();
  const whatsapp = {
    id: 42,
    tenantId: 7,
    update
  };
  const wbot = { id: 42 };

  beforeEach(() => {
    jest.clearAllMocks();
    update.mockResolvedValue(whatsapp);
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);
    (getIO as jest.Mock).mockReturnValue({ emit });
    (removeWbot as jest.Mock).mockResolvedValue(undefined);
    (initWbot as jest.Mock).mockResolvedValue(wbot);
  });

  it("recreates the session when sendSeen fails because the client is undefined", async () => {
    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(Whatsapp.findByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(emit).toHaveBeenCalledWith(`${whatsapp.tenantId}:whatsappSession`, {
      action: "update",
      session: whatsapp
    });
    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
    expect(
      (removeWbot as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan((initWbot as jest.Mock).mock.invocationCallOrder[0]);
  });

  it("also handles the newer sendSeen undefined error wording", async () => {
    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read properties of undefined (reading 'sendSeen')")
    );

    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
  });

  it("ignores unrelated errors", async () => {
    await StartWhatsAppSessionVerify(whatsapp.id, new Error("invalidNumber"));

    expect(Whatsapp.findByPk).not.toHaveBeenCalled();
    expect(removeWbot).not.toHaveBeenCalled();
    expect(initWbot).not.toHaveBeenCalled();
  });
});
