const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockFindByPk = jest.fn();

jest.mock("../../../libs/wbot", () => ({
  initWbot: mockInitWbot,
  removeWbot: mockRemoveWbot
}));

jest.mock("../../../libs/socket", () => ({
  getIO: jest.fn(() => ({ emit: jest.fn() }))
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: mockFindByPk
  }
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: jest.fn()
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => jest.fn());

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

import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

const buildWhatsapp = () =>
  ({
    id: 42,
    tenantId: 7,
    type: "whatsapp",
    update: jest.fn().mockResolvedValue(undefined)
  } as any);

describe("WhatsApp session recovery", () => {
  beforeEach(() => {
    mockInitWbot.mockResolvedValue({ id: 42 });
    mockRemoveWbot.mockClear();
    mockFindByPk.mockReset();
  });

  it("removes the stale in-memory session before starting a WhatsApp session", async () => {
    const whatsapp = buildWhatsapp();

    await StartWhatsAppSession(whatsapp);

    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
  });

  it("recovers sendSeen failures by replacing the stale in-memory session", async () => {
    const whatsapp = buildWhatsapp();
    mockFindByPk.mockResolvedValue(whatsapp);

    await StartWhatsAppSessionVerify(
      whatsapp.id,
      "TypeError: Cannot read property 'sendSeen' of undefined"
    );

    expect(mockFindByPk).toHaveBeenCalledWith(whatsapp.id);
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(mockRemoveWbot.mock.invocationCallOrder[0]).toBeLessThan(
      mockInitWbot.mock.invocationCallOrder[0]
    );
  });
});
