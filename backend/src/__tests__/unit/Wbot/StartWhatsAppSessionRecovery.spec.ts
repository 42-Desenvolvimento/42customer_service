const mockInitWbot = jest.fn();
const mockRemoveWbot = jest.fn();
const mockFindByPk = jest.fn();
const mockEmit = jest.fn();
const mockWbotMessageListener = jest.fn();
const mockWbotMonitor = jest.fn();

jest.mock("../../../libs/wbot", () => ({
  initWbot: (...args: any[]) => mockInitWbot(...args),
  removeWbot: (...args: any[]) => mockRemoveWbot(...args)
}));

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: {
    findByPk: (...args: any[]) => mockFindByPk(...args)
  }
}));

jest.mock("../../../libs/socket", () => ({
  getIO: () => ({
    emit: mockEmit
  })
}));

jest.mock("../../../services/WbotServices/wbotMessageListener", () => ({
  wbotMessageListener: (...args: any[]) => mockWbotMessageListener(...args)
}));

jest.mock("../../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: (...args: any[]) => mockWbotMonitor(...args)
}));

jest.mock("../../../services/TbotServices/StartTbotSession", () => ({
  StartTbotSession: jest.fn()
}));

jest.mock("../../../services/InstagramBotServices/StartInstaBotSession", () => ({
  StartInstaBotSession: jest.fn()
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
    info: jest.fn()
  }
}));

import { StartWhatsAppSession } from "../../../services/WbotServices/StartWhatsAppSession";
import { StartWhatsAppSessionVerify } from "../../../services/WbotServices/StartWhatsAppSessionVerify";

describe("StartWhatsAppSession recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    [
      "legacy sendSeen TypeError",
      new Error("TypeError: Cannot read property 'sendSeen' of undefined")
    ],
    [
      "current sendSeen TypeError",
      new Error("TypeError: Cannot read properties of undefined (reading 'sendSeen')")
    ]
  ])("removes the stale wbot before recovering from %s", async (_, error) => {
    const whatsapp = {
      id: 7,
      tenantId: 3,
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 7 };
    mockFindByPk.mockResolvedValue(whatsapp);
    mockInitWbot.mockResolvedValue(wbot);

    await StartWhatsAppSessionVerify(whatsapp.id, error);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockEmit).toHaveBeenCalledWith("3:whatsappSession", {
      action: "update",
      session: whatsapp
    });
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(
      mockRemoveWbot.mock.invocationCallOrder[0]
    ).toBeLessThan(mockInitWbot.mock.invocationCallOrder[0]);
    expect(mockWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });

  it("removes any previous wbot when starting a whatsapp session", async () => {
    const whatsapp = {
      id: 11,
      tenantId: 5,
      type: "whatsapp",
      update: jest.fn().mockResolvedValue(undefined)
    };
    const wbot = { id: 11 };
    mockInitWbot.mockResolvedValue(wbot);

    await StartWhatsAppSession(whatsapp as any);

    expect(whatsapp.update).toHaveBeenCalledWith({ status: "OPENING" });
    expect(mockRemoveWbot).toHaveBeenCalledWith(whatsapp.id);
    expect(mockInitWbot).toHaveBeenCalledWith(whatsapp);
    expect(
      mockRemoveWbot.mock.invocationCallOrder[0]
    ).toBeLessThan(mockInitWbot.mock.invocationCallOrder[0]);
    expect(mockWbotMessageListener).toHaveBeenCalledWith(wbot);
    expect(mockWbotMonitor).toHaveBeenCalledWith(wbot, whatsapp);
  });
});
