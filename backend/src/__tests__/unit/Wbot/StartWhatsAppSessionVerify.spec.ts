const mockEmit = jest.fn();
const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();
const mockWhatsappFindByPk = jest.fn();

jest.mock("../../../libs/wbot", () => ({
  initWbot: mockInitWbot,
  removeWbot: mockRemoveWbot
}));

jest.mock("../../../libs/socket", () => ({
  getIO: () => ({
    emit: mockEmit
  })
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: mockWbotMessageListener
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => mockWbotMonitor);

jest.mock("../../../models/Whatsapp", () => ({
  findByPk: mockWhatsappFindByPk
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
    error: jest.fn()
  }
}));

import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("Wbot session recovery", () => {
  const wbot = { id: 1 };

  const buildWhatsapp = () => ({
    id: 42,
    tenantId: 7,
    type: "whatsapp",
    update: jest.fn().mockResolvedValue(undefined)
  });

  beforeEach(() => {
    mockEmit.mockClear();
    mockInitWbot.mockClear();
    mockRemoveWbot.mockClear();
    mockWbotMessageListener.mockClear();
    mockWbotMonitor.mockClear();
    mockWhatsappFindByPk.mockClear();
    mockInitWbot.mockResolvedValue(wbot);
  });

  it("removes an existing WhatsApp client before starting a new session", async () => {
    const whatsapp = buildWhatsapp();

    await StartWhatsAppSession(whatsapp as any);

    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("removes an existing WhatsApp client before recovering a closed session", async () => {
    const whatsapp = buildWhatsapp();
    mockWhatsappFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(whatsapp.id, "Session closed");

    expect(mockWhatsappFindByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
    expect(mockWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
