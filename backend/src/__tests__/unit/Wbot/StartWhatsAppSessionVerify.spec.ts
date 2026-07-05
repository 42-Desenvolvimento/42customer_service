const mockEmit = jest.fn();
const mockFindByPk = jest.fn();
const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();

jest.mock("../../../libs/socket", () => ({
  getIO: () => ({
    emit: mockEmit
  })
}));

jest.mock("../../../libs/wbot", () => ({
  initWbot: mockInitWbot,
  removeWbot: mockRemoveWbot
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindByPk
  }
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: mockWbotMessageListener
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: mockWbotMonitor
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

  it("removes the stale session before recovering from sendSeen failures", async () => {
    const whatsapp = buildWhatsapp();
    mockFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith(
      `${whatsapp.tenantId}:whatsappSession`,
      {
        action: "update",
        session: whatsapp
      }
    );
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockWbotMessageListener).toHaveBeenCalledWith({ id: 42 });
    expect(mockWbotMonitor).toHaveBeenCalledWith({ id: 42 }, whatsapp);
  });

  it("removes the stale session before starting a whatsapp connection", async () => {
    const whatsapp = buildWhatsapp();

    await StartWhatsAppSession(whatsapp as any);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
  });
});
