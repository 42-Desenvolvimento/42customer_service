const mockEmit = jest.fn();
const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockMessageListener = jest.fn();
const mockMonitor = jest.fn();

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: mockEmit }))
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: mockInitWbot,
  removeWbot: mockRemoveWbot
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: jest.fn()
  }
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: mockMessageListener
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: mockMonitor
}));

jest.mock(
  "../../../services/InstagramBotServices/StartInstaBotSession",
  () => ({
    StartInstaBotSession: jest.fn()
  })
);

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: jest.fn()
}));

jest.mock("../../../services/WABA360/StartWaba360", () => ({
  StartWaba360: jest.fn()
}));

jest.mock(
  "../../../services/MessengerChannelServices/StartMessengerBot",
  () => ({
    StartMessengerBot: jest.fn()
  })
);

jest.mock("../../../utils/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

import Whatsapp from "../../../models/Whatsapp";
import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const buildWhatsapp = () => ({
  id: 42,
  tenantId: 7,
  type: "whatsapp",
  update: jest.fn()
});

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitWbot.mockResolvedValue({ id: 42 });
  });

  it("recovers a stale session when sendSeen fails", async () => {
    const whatsapp = buildWhatsapp();
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new TypeError("Cannot read property 'sendSeen' of undefined")
    );

    expect(Whatsapp.findByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith("7:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockMessageListener).toHaveBeenCalledWith({ id: 42 });
    expect(mockMonitor).toHaveBeenCalledWith({ id: 42 }, whatsapp);
  });

  it("recovers when callers pass an Error object for an uninitialized session", async () => {
    const whatsapp = buildWhatsapp();
    (Whatsapp.findByPk as jest.Mock).mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      new Error("ERR_WAPP_NOT_INITIALIZED")
    );

    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
  });

  it("removes an existing whatsapp client before starting a new one", async () => {
    const whatsapp = buildWhatsapp();

    await StartWhatsAppSession(whatsapp as any);

    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockMessageListener).toHaveBeenCalledWith({ id: 42 });
    expect(mockMonitor).toHaveBeenCalledWith({ id: 42 }, whatsapp);
  });
});
