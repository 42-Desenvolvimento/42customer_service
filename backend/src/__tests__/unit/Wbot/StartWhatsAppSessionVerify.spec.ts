import Whatsapp from "../../../models/Whatsapp";
import { getIO } from "../../../libs/socket";
import { initWbot, removeWbot } from "../../../libs/wbot";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
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

jest.mock("../../../services/InstagramBotServices/StartInstaBotSession", () => ({
  StartInstaBotSession: jest.fn()
}));

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: jest.fn()
}));

jest.mock("../../../services/WABA360/StartWaba360", () => ({
  StartWaba360: jest.fn()
}));

jest.mock("../../../services/MessengerChannelServices/StartMessengerBot", () => ({
  StartMessengerBot: jest.fn()
}));

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

describe("StartWhatsAppSessionVerify", () => {
  const emit = jest.fn();
  const wbot = { id: 42 };

  const buildWhatsapp = () => ({
    id: 42,
    tenantId: 7,
    type: "whatsapp",
    update: jest.fn().mockResolvedValue(undefined)
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (getIO as jest.Mock).mockReturnValue({ emit });
    (initWbot as jest.Mock).mockResolvedValue(wbot);
  });

  it("removes stale session before reinitializing after a closed session error", async () => {
    const whatsapp = buildWhatsapp();
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(whatsapp.id, "Error: session closed");

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect((removeWbot as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (initWbot as jest.Mock).mock.invocationCallOrder[0]
    );
    expect(wbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(wbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("recognizes the current sendSeen undefined error format", async () => {
    const whatsapp = buildWhatsapp();
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read properties of undefined (reading 'sendSeen')")
    );

    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
  });

  it("does not restart whatsapp for unrelated errors", async () => {
    await StartWhatsAppSessionVerify(42, "network timeout");

    expect(Whatsapp.findByPk).not.toHaveBeenCalled();
    expect(removeWbot).not.toHaveBeenCalled();
    expect(initWbot).not.toHaveBeenCalled();
  });
});

describe("StartWhatsAppSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getIO as jest.Mock).mockReturnValue({ emit: jest.fn() });
    (initWbot as jest.Mock).mockResolvedValue({ id: 42 });
  });

  it("removes an existing whatsapp session before starting a new client", async () => {
    const whatsapp = {
      id: 42,
      tenantId: 7,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };

    await StartWhatsAppSession(whatsapp as any);

    expect(removeWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(initWbot).toHaveBeenCalledWith(whatsapp);
    expect((removeWbot as jest.Mock).mock.invocationCallOrder[0]).toBeLessThan(
      (initWbot as jest.Mock).mock.invocationCallOrder[0]
    );
  });
});
