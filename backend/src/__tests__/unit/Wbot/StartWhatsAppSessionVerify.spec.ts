import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";
import Whatsapp from "../../../models/Whatsapp";

jest.mock("../../../libs/wbot", () => ({
  initWbot: jest.fn(),
  removeWbot: jest.fn()
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({
    emit: jest.fn()
  }))
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => jest.fn());

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("StartWhatsAppSession recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (initWbot as jest.Mock).mockResolvedValue({ id: 42 });
  });

  it("removes the cached session before recovering from sendSeen disconnection", async () => {
    const whatsapp = {
      id: 42,
      tenantId: 1,
      update: jest.fn().mockResolvedValue(undefined)
    };

    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      42,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(Whatsapp.findByPk).toHaveBeenCalledWith(42);
    expect(removeWbot).toHaveBeenCalledWith(42);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(
      (removeWbot as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan((initWbot as jest.Mock).mock.invocationCallOrder[0]);
  });

  it("removes the cached session before starting a WhatsApp session", async () => {
    const whatsapp = {
      id: 43,
      tenantId: 1,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };

    await StartWhatsAppSession(whatsapp as any);

    expect(removeWbot).toHaveBeenCalledWith(43);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect(
      (removeWbot as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan((initWbot as jest.Mock).mock.invocationCallOrder[0]);
  });
});
